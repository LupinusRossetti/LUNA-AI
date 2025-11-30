/**
 * YouTube ライブ配信ID自動取得スクリプト
 * 
 * 使用方法:
 * 1. .envファイルに以下を設定:
 *    - NEXT_PUBLIC_YOUTUBE_API_KEY (必須)
 *    - NEXT_PUBLIC_YOUTUBE_CHANNEL_ID (オプション、OAuth使用時は不要)
 *    - REFRESH_TOKEN (オプション、OAuth使用時)
 * 
 * 2. node scripts/get-live-stream-id.js を実行
 * 
 * 戻り値: JSON形式で出力
 * {
 *   "liveStreamId": "配信ID",
 *   "isLive": true/false,
 *   "latestVideoId": "最新動画ID" (配信がない場合)
 * }
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// .envファイルを読み込む
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    process.stderr.write('Error: .env file not found.\n');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
        if (key) {
          env[key] = value || ''; // 空の値も設定する
        }
      }
    }
  });

  // デバッグ用: 読み込んだ環境変数を確認
  if (!env.NEXT_PUBLIC_YOUTUBE_API_KEY || env.NEXT_PUBLIC_YOUTUBE_API_KEY.trim() === '') {
    process.stderr.write('Warning: NEXT_PUBLIC_YOUTUBE_API_KEY not found or empty in .env\n');
  }

  const hasChannelId = env.NEXT_PUBLIC_YOUTUBE_CHANNEL_ID && env.NEXT_PUBLIC_YOUTUBE_CHANNEL_ID.trim() !== '';
  const hasRefreshToken = env.REFRESH_TOKEN && env.REFRESH_TOKEN.trim() !== '';

  if (!hasChannelId && !hasRefreshToken) {
    process.stderr.write('Warning: Neither NEXT_PUBLIC_YOUTUBE_CHANNEL_ID nor REFRESH_TOKEN found or empty in .env\n');
    process.stderr.write('Debug: Checking all loaded env keys...\n');
    const loadedKeys = Object.keys(env).filter(k => k.includes('YOUTUBE') || k.includes('CHANNEL') || k.includes('REFRESH') || k.includes('CLIENT'));
    if (loadedKeys.length > 0) {
      process.stderr.write(`Found keys: ${loadedKeys.join(', ')}\n`);
      loadedKeys.forEach(k => {
        const value = env[k];
        if (value && value.trim() !== '') {
          const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
          process.stderr.write(`  ${k}: ${displayValue} (length: ${value.length})\n`);
        } else {
          process.stderr.write(`  ${k}: (empty or whitespace only)\n`);
          // 実際の値を16進数で表示（デバッグ用）
          if (value !== undefined) {
            const hex = Buffer.from(value || '', 'utf-8').toString('hex');
            process.stderr.write(`    Hex: ${hex}\n`);
          }
        }
      });
    } else {
      process.stderr.write('No relevant keys found in .env\n');
    }
  }

  return env;
}

// OAuth認証でアクセストークンを取得
function getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`OAuth Error: ${json.error} - ${json.error_description || ''}`));
          } else {
            resolve(json.access_token);
          }
        } catch (e) {
          reject(new Error(`Failed to parse OAuth response: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// YouTube APIリクエストを送信
function youtubeApiRequest(endpoint, params, accessToken = null) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const url = `https://youtube.googleapis.com/youtube/v3/${endpoint}?${query}`;

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (accessToken) {
      options.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`YouTube API Error: ${JSON.stringify(json.error)}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Failed to parse YouTube API response: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

// OAuth認証を使って現在のライブ配信を取得
async function getLiveStreamIdWithOAuth(apiKey, clientId, clientSecret, refreshToken) {
  try {
    // アクセストークンを取得
    const accessToken = await getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken);

    // 自分のチャンネルの情報を取得
    const channelResponse = await youtubeApiRequest('channels', {
      part: 'id',
      mine: 'true'
    }, accessToken);

    if (!channelResponse.items || channelResponse.items.length === 0) {
      process.stderr.write('Error: Channel not found.\n');
      return { liveStreamId: '', isLive: false, latestVideoId: '', channelId: '' };
    }

    const channelId = channelResponse.items[0].id;

    // まず liveBroadcasts.list を使用して配信中のライブ配信を取得
    // このエンドポイントは限定公開・非公開のライブ配信も取得できる
    process.stderr.write('Checking live broadcasts (including unlisted/private)...\n');
    try {
      const liveBroadcastsResponse = await youtubeApiRequest('liveBroadcasts', {
        part: 'id,snippet,status',
        mine: 'true',
        broadcastType: 'all',
        maxResults: 50
      }, accessToken);

      process.stderr.write(`liveBroadcasts returned ${liveBroadcastsResponse.items?.length || 0} broadcasts\n`);

      if (liveBroadcastsResponse.items && liveBroadcastsResponse.items.length > 0) {
        // lifeCycleStatus が 'live' のものをフィルタリング
        const activeBroadcasts = liveBroadcastsResponse.items.filter(item =>
          item.status?.lifeCycleStatus === 'live'
        );

        process.stderr.write(`Found ${activeBroadcasts.length} active broadcasts\n`);

        if (activeBroadcasts.length > 0) {
          // デバッグ: 見つかったライブ配信をすべて表示
          process.stderr.write('Active broadcasts found:\n');
          activeBroadcasts.forEach((item, index) => {
            const broadcastId = item.id;
            const publishedAt = item.snippet?.publishedAt;
            const title = item.snippet?.title;
            const privacyStatus = item.status?.privacyStatus;
            const lifeCycleStatus = item.status?.lifeCycleStatus;
            process.stderr.write(`  ${index + 1}. ${broadcastId} (published: ${publishedAt}, privacy: ${privacyStatus}, status: ${lifeCycleStatus})\n`);
            if (title) {
              process.stderr.write(`     Title: ${title}\n`);
            }
          });

          // 最新の配信を取得（publishedAtでソート）
          const liveVideos = activeBroadcasts
            .map(item => ({
              videoId: item.id,
              publishedAt: item.snippet?.publishedAt
            }))
            .filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));

          if (liveVideos.length > 0) {
            // publishedAtでソートして最新のものを取得
            liveVideos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
            const videoId = liveVideos[0].videoId;
            process.stderr.write(`Found active broadcast (latest): ${videoId}\n`);
            return {
              liveStreamId: videoId,
              isLive: true,
              latestVideoId: '',
              channelId: channelId
            };
          }
        }
      }
    } catch (e) {
      process.stderr.write(`liveBroadcasts API call failed: ${e.message}\n`);
      process.stderr.write('Falling back to search endpoint...\n');
    }

    // フォールバック: search エンドポイントを使用（公開配信のみ）
    process.stderr.write('Checking public live streams via search endpoint...\n');
    const searchResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      eventType: 'live',
      maxResults: 10
    }, accessToken);

    process.stderr.write(`Live search returned ${searchResponse.items?.length || 0} items\n`);

    if (searchResponse.items && searchResponse.items.length > 0) {
      // デバッグ: 見つかったライブ配信をすべて表示
      process.stderr.write('Live streams found:\n');
      searchResponse.items.forEach((item, index) => {
        const videoId = item.id?.videoId;
        const publishedAt = item.snippet?.publishedAt;
        const title = item.snippet?.title;
        process.stderr.write(`  ${index + 1}. ${videoId} (published: ${publishedAt})\n`);
        if (title) {
          process.stderr.write(`     Title: ${title}\n`);
        }
      });

      // 最新の配信を取得（publishedAtでソート）
      const liveVideos = searchResponse.items
        .map(item => ({
          videoId: item.id?.videoId,
          publishedAt: item.snippet?.publishedAt
        }))
        .filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));

      if (liveVideos.length > 0) {
        // publishedAtでソートして最新のものを取得
        liveVideos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
        const videoId = liveVideos[0].videoId;
        process.stderr.write(`Found live stream (latest): ${videoId}\n`);
        return {
          liveStreamId: videoId,
          isLive: true,
          latestVideoId: '',
          channelId: channelId
        };
      } else {
        process.stderr.write(`Warning: No valid live stream IDs found\n`);
      }
    }


    // 予約配信（upcoming）を検索
    process.stderr.write('No live streams found. Searching for upcoming streams...\n');

    // まず liveBroadcasts.list を使用（限定公開も取得可能）
    try {
      const upcomingBroadcastsResponse = await youtubeApiRequest('liveBroadcasts', {
        part: 'id,snippet,status',
        mine: 'true',
        broadcastType: 'all',
        maxResults: 50
      }, accessToken);

      // lifeCycleStatus が 'created', 'ready', 'testing' のものをフィルタリング（upcoming）
      const upcomingBroadcasts = (upcomingBroadcastsResponse.items || []).filter(item =>
        item.status?.lifeCycleStatus === 'created' ||
        item.status?.lifeCycleStatus === 'ready' ||
        item.status?.lifeCycleStatus === 'testing'
      );

      process.stderr.write(`Found ${upcomingBroadcasts.length} upcoming broadcasts\n`);

      if (upcomingBroadcasts.length > 0) {
        // デバッグ: 見つかった予約配信をすべて表示
        process.stderr.write('Upcoming broadcasts found:\n');
        upcomingBroadcasts.forEach((item, index) => {
          const broadcastId = item.id;
          const publishedAt = item.snippet?.publishedAt;
          const title = item.snippet?.title;
          const privacyStatus = item.status?.privacyStatus;
          const lifeCycleStatus = item.status?.lifeCycleStatus;
          process.stderr.write(`  ${index + 1}. ${broadcastId} (published: ${publishedAt}, privacy: ${privacyStatus}, status: ${lifeCycleStatus})\n`);
          if (title) {
            process.stderr.write(`     Title: ${title}\n`);
          }
        });

        // 最新の予約配信を取得（publishedAtでソート）
        const upcomingVideos = upcomingBroadcasts
          .map(item => ({
            videoId: item.id,
            publishedAt: item.snippet?.publishedAt
          }))
          .filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));

        if (upcomingVideos.length > 0) {
          // publishedAtでソートして最新のものを取得
          upcomingVideos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
          const videoId = upcomingVideos[0].videoId;
          process.stderr.write(`Found upcoming broadcast (latest): ${videoId}\n`);
          return {
            liveStreamId: videoId,
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      }
    } catch (e) {
      process.stderr.write(`liveBroadcasts (upcoming) API call failed: ${e.message}\n`);
      process.stderr.write('Falling back to search endpoint for upcoming...\n');
    }

    // フォールバック: search エンドポイントを使用（公開配信のみ）
    try {
      const upcomingResponse = await youtubeApiRequest('search', {
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        eventType: 'upcoming',
        maxResults: 10
      }, accessToken);

      process.stderr.write(`Upcoming search returned ${upcomingResponse.items?.length || 0} items\n`);

      if (upcomingResponse.items && upcomingResponse.items.length > 0) {
        // 最新の予約配信を取得（publishedAtでソート）
        const upcomingVideos = upcomingResponse.items.map(item => ({
          videoId: item.id?.videoId,
          publishedAt: item.snippet?.publishedAt
        })).filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));

        if (upcomingVideos.length > 0) {
          // publishedAtでソートして最新のものを取得
          upcomingVideos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
          const videoId = upcomingVideos[0].videoId;
          process.stderr.write(`Found upcoming stream (latest): ${videoId}\n`);
          return {
            liveStreamId: videoId,
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      } else {
        process.stderr.write('No upcoming streams found with eventType: upcoming\n');
        // eventType: 'upcoming'で見つからない場合、publishedAfterパラメータを使って最近の動画を検索
        // 過去90日以内の動画を検索（より長い期間をカバー）
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const publishedAfter = ninetyDaysAgo.toISOString();

        process.stderr.write(`Searching for videos published after ${publishedAfter}...\n`);
        const recentVideoResponse = await youtubeApiRequest('search', {
          part: 'id,snippet',
          channelId: channelId,
          type: 'video',
          order: 'date',
          publishedAfter: publishedAfter,
          maxResults: 50
        }, accessToken);

        if (recentVideoResponse.items && recentVideoResponse.items.length > 0) {
          // 予約配信（liveBroadcastContent: 'upcoming'）を探す
          const upcomingVideo = recentVideoResponse.items.find(item =>
            item.snippet?.liveBroadcastContent === 'upcoming'
          );

          if (upcomingVideo) {
            const videoId = upcomingVideo.id?.videoId;
            process.stderr.write(`Found upcoming stream in recent videos: ${videoId}\n`);
            if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
              return {
                liveStreamId: videoId,
                isLive: false,
                latestVideoId: videoId,
                channelId: channelId
              };
            }
          }

          // search APIで見つからない場合、videos APIで直接確認
          const recentVideoIds = recentVideoResponse.items
            .map(item => item.id?.videoId)
            .filter(id => id && id.length === 11 && /^[a-zA-Z0-9_-]+$/.test(id));

          if (recentVideoIds.length > 0) {
            process.stderr.write(`Checking ${recentVideoIds.length} recent videos with videos API...\n`);
            for (let i = 0; i < recentVideoIds.length; i += 50) {
              const batch = recentVideoIds.slice(i, i + 50);
              const videoDetails = await youtubeApiRequest('videos', {
                part: 'id,snippet,liveStreamingDetails',
                id: batch.join(',')
              }, accessToken);

              if (videoDetails.items && videoDetails.items.length > 0) {
                const upcomingVideo = videoDetails.items.find(video =>
                  video.snippet?.liveBroadcastContent === 'upcoming'
                );

                if (upcomingVideo) {
                  const videoId = upcomingVideo.id;
                  process.stderr.write(`Found upcoming stream via videos API in recent videos: ${videoId}\n`);
                  if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
                    return {
                      liveStreamId: videoId,
                      isLive: false,
                      latestVideoId: videoId,
                      channelId: channelId
                    };
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      process.stderr.write(`eventType: 'upcoming' search failed: ${e.message}\n`);
    }

    // 予約配信も見つからない場合、最新のアーカイブ配信を取得
    process.stderr.write('No upcoming streams found. Getting latest archive video...\n');
    const latestVideoResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      order: 'date',
      maxResults: 10
    }, accessToken);

    if (latestVideoResponse.items && latestVideoResponse.items.length > 0) {
      // アーカイブ配信（liveBroadcastContent: 'none'）を探す
      const archiveVideo = latestVideoResponse.items.find(item => {
        const broadcastContent = item.snippet?.liveBroadcastContent;
        return broadcastContent === 'none' || !broadcastContent;
      });

      if (archiveVideo) {
        const videoId = archiveVideo.id?.videoId;
        if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
          process.stderr.write(`Found latest archive video: ${videoId}\n`);
          return {
            liveStreamId: '',
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      }

      // アーカイブ配信が見つからない場合、最新の動画を返す
      const firstVideo = latestVideoResponse.items[0];
      const videoId = firstVideo.id?.videoId;
      if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        process.stderr.write(`Found latest video: ${videoId}\n`);
        return {
          liveStreamId: '',
          isLive: false,
          latestVideoId: videoId,
          channelId: channelId
        };
      }
    }

    return { liveStreamId: '', isLive: false, latestVideoId: '', channelId: channelId };
  } catch (error) {
    process.stderr.write(`Error getting live stream with OAuth: ${error.message}\n`);
    return { liveStreamId: '', isLive: false, latestVideoId: '', channelId: '' };
  }
}

// API KeyとチャンネルIDを使って現在のライブ配信を取得
async function getLiveStreamIdWithApiKey(apiKey, channelId) {
  try {
    // 現在のライブ配信を検索（複数のライブ配信がある場合に備えて複数取得）
    const searchResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      eventType: 'live',
      maxResults: 10,
      key: apiKey
    });

    process.stderr.write(`Live search returned ${searchResponse.items?.length || 0} items\n`);

    if (searchResponse.items && searchResponse.items.length > 0) {
      // デバッグ: 見つかったライブ配信をすべて表示
      process.stderr.write('Live streams found:\n');
      searchResponse.items.forEach((item, index) => {
        const videoId = item.id?.videoId;
        const publishedAt = item.snippet?.publishedAt;
        const title = item.snippet?.title;
        process.stderr.write(`  ${index + 1}. ${videoId} (published: ${publishedAt})\n`);
        if (title) {
          process.stderr.write(`     Title: ${title}\n`);
        }
      });

      // 最新の配信を取得（publishedAtでソート）
      const liveVideos = searchResponse.items
        .map(item => ({
          videoId: item.id?.videoId,
          publishedAt: item.snippet?.publishedAt
        }))
        .filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));

      if (liveVideos.length > 0) {
        // publishedAtでソートして最新のものを取得
        liveVideos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
        const videoId = liveVideos[0].videoId;
        process.stderr.write(`Found live stream (latest): ${videoId}\n`);
        return {
          liveStreamId: videoId,
          isLive: true,
          latestVideoId: '',
          channelId: channelId
        };
      } else {
        process.stderr.write(`Warning: No valid live stream IDs found\n`);
      }
    }

    // 予約配信（upcoming）を検索 - eventType: 'upcoming'を使用
    process.stderr.write('No live streams found. Searching for upcoming streams (API Key)...\n');
    try {
      const upcomingResponse = await youtubeApiRequest('search', {
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        eventType: 'upcoming',
        maxResults: 10,
        key: apiKey
      });

      process.stderr.write(`Upcoming search returned ${upcomingResponse.items?.length || 0} items\n`);

      if (upcomingResponse.items && upcomingResponse.items.length > 0) {
        // 最新の予約配信を取得（publishedAtでソート）
        const upcomingVideos = upcomingResponse.items.map(item => ({
          videoId: item.id?.videoId,
          publishedAt: item.snippet?.publishedAt
        })).filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));

        if (upcomingVideos.length > 0) {
          // publishedAtでソートして最新のものを取得
          upcomingVideos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
          const videoId = upcomingVideos[0].videoId;
          process.stderr.write(`Found upcoming stream (latest, API Key): ${videoId}\n`);
          return {
            liveStreamId: videoId,
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      } else {
        process.stderr.write('No upcoming streams found with eventType: upcoming (API Key)\n');
      }
    } catch (e) {
      process.stderr.write(`eventType: 'upcoming' search failed (API Key): ${e.message}\n`);
    }

    // 予約配信も見つからない場合、最新のアーカイブ配信を取得
    process.stderr.write('No upcoming streams found. Getting latest archive video (API Key)...\n');
    const latestVideoResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      order: 'date',
      maxResults: 10,
      key: apiKey
    });

    if (latestVideoResponse.items && latestVideoResponse.items.length > 0) {
      // アーカイブ配信（liveBroadcastContent: 'none'）を探す
      const archiveVideo = latestVideoResponse.items.find(item => {
        const broadcastContent = item.snippet?.liveBroadcastContent;
        return broadcastContent === 'none' || !broadcastContent;
      });

      if (archiveVideo) {
        const videoId = archiveVideo.id?.videoId;
        if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
          process.stderr.write(`Found latest archive video (API Key): ${videoId}\n`);
          return {
            liveStreamId: '',
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      }

      // アーカイブ配信が見つからない場合、最新の動画を返す
      const firstVideo = latestVideoResponse.items[0];
      const videoId = firstVideo.id?.videoId;
      if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        process.stderr.write(`Found latest video (API Key): ${videoId}\n`);
        return {
          liveStreamId: '',
          isLive: false,
          latestVideoId: videoId,
          channelId: channelId
        };
      }
    }

    return { liveStreamId: '', isLive: false, latestVideoId: '', channelId: channelId };
  } catch (error) {
    process.stderr.write(`Error getting live stream with API Key: ${error.message}\n`);
    return { liveStreamId: '', isLive: false, latestVideoId: '', channelId: channelId };
  }
}

// メイン処理
async function main() {
  const env = loadEnvFile();

  const apiKey = env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  const channelId = env.NEXT_PUBLIC_YOUTUBE_CHANNEL_ID;
  const clientId = env.CLIENT_ID;
  const clientSecret = env.CLIENT_SECRET;
  const refreshToken = env.REFRESH_TOKEN;
  // .envのNEXT_PUBLIC_YOUTUBE_UPCOMING_STREAM_IDは使用しない
  // 優先順位: 1. 配信中 → 2. 予約中（最新） → 3. 最新アーカイブ

  if (!apiKey || apiKey.trim() === '') {
    process.stderr.write('Error: NEXT_PUBLIC_YOUTUBE_API_KEY is not set in .env file.\n');
    process.exit(1);
  }

  let result = { liveStreamId: '', isLive: false, latestVideoId: '', channelId: '' };

  // OAuth認証が利用可能な場合は優先（空文字列でないことを確認）
  // OAuth認証を使えば、チャンネルIDは不要（自動で自分のチャンネルを取得）
  if (clientId && clientSecret && refreshToken &&
    clientId.trim() !== '' && clientSecret.trim() !== '' && refreshToken.trim() !== '') {
    process.stderr.write('Using OAuth authentication to get live stream ID (Channel ID not required)...\n');
    result = await getLiveStreamIdWithOAuth(apiKey, clientId, clientSecret, refreshToken);
  } else if (channelId && channelId.trim() !== '') {
    // REFRESH_TOKENがない場合はチャンネルIDを使用
    process.stderr.write('Using API Key and Channel ID to get live stream ID...\n');
    result = await getLiveStreamIdWithApiKey(apiKey, channelId);
  } else {
    process.stderr.write('Error: Either REFRESH_TOKEN (with CLIENT_ID and CLIENT_SECRET) or NEXT_PUBLIC_YOUTUBE_CHANNEL_ID must be set in .env file.\n');
    process.stderr.write('\nRecommended: Use REFRESH_TOKEN (Channel ID not required)\n');
    process.stderr.write('  - Set CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN\n');
    process.stderr.write('  - Run: get-refresh-token.bat to get REFRESH_TOKEN\n');
    process.stderr.write('\nAlternative: Use Channel ID\n');
    process.stderr.write('  - Set NEXT_PUBLIC_YOUTUBE_CHANNEL_ID\n');
    process.stderr.write('\nDebug info:\n');
    process.stderr.write(`  NEXT_PUBLIC_YOUTUBE_API_KEY: ${apiKey && apiKey.trim() !== '' ? 'SET' : 'NOT SET'}\n`);
    process.stderr.write(`  CLIENT_ID: ${clientId && clientId.trim() !== '' ? 'SET' : 'NOT SET or EMPTY'}\n`);
    process.stderr.write(`  CLIENT_SECRET: ${clientSecret && clientSecret.trim() !== '' ? 'SET' : 'NOT SET or EMPTY'}\n`);
    process.stderr.write(`  REFRESH_TOKEN: ${refreshToken && refreshToken.trim() !== '' ? 'SET' : 'NOT SET or EMPTY'}\n`);
    process.stderr.write(`  NEXT_PUBLIC_YOUTUBE_CHANNEL_ID: ${channelId && channelId.trim() !== '' ? `SET (${channelId.substring(0, Math.min(20, channelId.length))}...)` : 'NOT SET or EMPTY'}\n`);
    process.stderr.write('\nPlease check your .env file and make sure the values are set correctly.\n');
    process.exit(1);
  }

  // JSON形式で結果を出力（空文字列でも有効な結果として扱う）
  // stdoutにのみJSONを出力（stderrにはデバッグメッセージのみ）
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(0);
}

// 実行
main().catch((error) => {
  process.stderr.write(`Unexpected error: ${error.message}\n`);
  process.exit(1);
});
