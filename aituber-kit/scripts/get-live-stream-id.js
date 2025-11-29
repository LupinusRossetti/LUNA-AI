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
    
    // 現在のライブ配信を検索
    const searchResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      eventType: 'live',
      maxResults: 1
    }, accessToken);
    
    if (searchResponse.items && searchResponse.items.length > 0) {
      const videoId = searchResponse.items[0].id?.videoId;
      // 動画IDの形式を検証（通常11文字の英数字）
      if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        return {
          liveStreamId: videoId,
          isLive: true,
          latestVideoId: '',
          channelId: channelId
        };
      } else {
        process.stderr.write(`Warning: Invalid live stream ID format: ${videoId}\n`);
        process.stderr.write(`Response: ${JSON.stringify(searchResponse.items[0].id)}\n`);
      }
    }
    
    // 予約配信（upcoming）を検索 - eventType: 'upcoming'を使用
    process.stderr.write('Searching for upcoming streams with eventType: upcoming...\n');
    try {
      const upcomingResponse = await youtubeApiRequest('search', {
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        eventType: 'upcoming',
        maxResults: 50
      }, accessToken);
      
      process.stderr.write(`Upcoming search returned ${upcomingResponse.items?.length || 0} items\n`);
      
      if (upcomingResponse.items && upcomingResponse.items.length > 0) {
        // 最新の予約配信を取得（scheduledStartTimeが最も近いもの）
        const upcomingVideos = upcomingResponse.items.map(item => ({
          videoId: item.id?.videoId,
          publishedAt: item.snippet?.publishedAt
        })).filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));
        
        if (upcomingVideos.length > 0) {
          // publishedAtでソートして最新のものを取得
          upcomingVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
          const videoId = upcomingVideos[0].videoId;
          process.stderr.write(`Found upcoming stream via eventType: ${videoId}\n`);
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
    
    // ライブ配信がない場合、最新の動画を取得（予約配信も含む）
    // より多くの動画を取得して予約配信を探す（maxResultsを増やす）
    const latestVideoResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      order: 'date',
      maxResults: 50
    }, accessToken);
    
    // もし50件で見つからなければ、次のページも取得
    let allVideos = latestVideoResponse.items || [];
    let nextPageToken = latestVideoResponse.nextPageToken;
    let pageCount = 1;
    
    while (nextPageToken && pageCount < 5) {
      process.stderr.write(`Fetching page ${pageCount + 1}...\n`);
      const nextPageResponse = await youtubeApiRequest('search', {
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        order: 'date',
        maxResults: 50,
        pageToken: nextPageToken
      }, accessToken);
      
      if (nextPageResponse.items && nextPageResponse.items.length > 0) {
        allVideos = allVideos.concat(nextPageResponse.items);
        nextPageToken = nextPageResponse.nextPageToken;
        pageCount++;
      } else {
        break;
      }
    }
    
    process.stderr.write(`Total videos checked: ${allVideos.length}\n`);
    
    if (allVideos.length > 0) {
      // 予約配信（liveBroadcastContent: 'upcoming'）を優先的に探す
      const upcomingVideo = allVideos.find(item => {
        const broadcastContent = item.snippet?.liveBroadcastContent;
        return broadcastContent === 'upcoming';
      });
      
      if (upcomingVideo) {
        const videoId = upcomingVideo.id?.videoId;
        process.stderr.write(`Found upcoming stream: ${videoId}\n`);
        if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
          return {
            liveStreamId: videoId,
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      }
      
      // search APIで見つからない場合、videos APIで複数の動画を直接確認
      // より多くの動画を確認する（50件まで）
      process.stderr.write('Checking latest videos with videos API...\n');
      const videoIdsToCheck = allVideos.slice(0, 50)
        .map(item => item.id?.videoId)
        .filter(id => id && id.length === 11 && /^[a-zA-Z0-9_-]+$/.test(id));
      
      if (videoIdsToCheck.length > 0) {
        try {
          // videos APIは最大50件まで一度に取得可能
          // 50件を超える場合は複数回に分けて取得
          for (let i = 0; i < videoIdsToCheck.length; i += 50) {
            const batch = videoIdsToCheck.slice(i, i + 50);
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
                process.stderr.write(`Found upcoming stream via videos API: ${videoId}\n`);
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
        } catch (e) {
          process.stderr.write(`Error checking video details: ${e.message}\n`);
        }
      }
      
      // それでも見つからない場合、最新の動画を返す
      process.stderr.write(`No upcoming stream found in ${allVideos.length} videos\n`);
      
      // 予約配信がない場合、最新の動画を取得
      if (allVideos.length > 0) {
        const firstVideo = allVideos[0];
        const videoId = firstVideo.id?.videoId;
        // 動画IDの形式を検証（通常11文字の英数字）
        if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
          return {
            liveStreamId: '',
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        } else {
          process.stderr.write(`Warning: Invalid video ID format: ${videoId}\n`);
          process.stderr.write(`Response: ${JSON.stringify(firstVideo.id)}\n`);
        }
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
    // 現在のライブ配信を検索
    const searchResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      eventType: 'live',
      maxResults: 1,
      key: apiKey
    });
    
    if (searchResponse.items && searchResponse.items.length > 0) {
      const videoId = searchResponse.items[0].id?.videoId;
      // 動画IDの形式を検証（通常11文字の英数字）
      if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        return {
          liveStreamId: videoId,
          isLive: true,
          latestVideoId: '',
          channelId: channelId
        };
      } else {
        process.stderr.write(`Warning: Invalid live stream ID format: ${videoId}\n`);
        process.stderr.write(`Response: ${JSON.stringify(searchResponse.items[0].id)}\n`);
      }
    }
    
    // 予約配信（upcoming）を検索 - eventType: 'upcoming'を使用
    process.stderr.write('Searching for upcoming streams with eventType: upcoming (API Key)...\n');
    try {
      const upcomingResponse = await youtubeApiRequest('search', {
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        eventType: 'upcoming',
        maxResults: 50,
        key: apiKey
      });
      
      process.stderr.write(`Upcoming search returned ${upcomingResponse.items?.length || 0} items\n`);
      
      if (upcomingResponse.items && upcomingResponse.items.length > 0) {
        // 最新の予約配信を取得（scheduledStartTimeが最も近いもの）
        const upcomingVideos = upcomingResponse.items.map(item => ({
          videoId: item.id?.videoId,
          publishedAt: item.snippet?.publishedAt
        })).filter(item => item.videoId && item.videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(item.videoId));
        
        if (upcomingVideos.length > 0) {
          // publishedAtでソートして最新のものを取得
          upcomingVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
          const videoId = upcomingVideos[0].videoId;
          process.stderr.write(`Found upcoming stream via eventType: ${videoId}\n`);
          return {
            liveStreamId: videoId,
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      } else {
        process.stderr.write('No upcoming streams found with eventType: upcoming\n');
      }
    } catch (e) {
      process.stderr.write(`eventType: 'upcoming' search failed: ${e.message}\n`);
    }
    
    // ライブ配信がない場合、最新の動画を取得（予約配信も含む）
    const latestVideoResponse = await youtubeApiRequest('search', {
      part: 'id,snippet',
      channelId: channelId,
      type: 'video',
      order: 'date',
      maxResults: 50,
      key: apiKey
    });
    
    // もし50件で見つからなければ、次のページも取得
    let allVideos = latestVideoResponse.items || [];
    let nextPageToken = latestVideoResponse.nextPageToken;
    let pageCount = 1;
    
    while (nextPageToken && pageCount < 5) {
      process.stderr.write(`Fetching page ${pageCount + 1} (API Key)...\n`);
      const nextPageResponse = await youtubeApiRequest('search', {
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        order: 'date',
        maxResults: 50,
        pageToken: nextPageToken,
        key: apiKey
      });
      
      if (nextPageResponse.items && nextPageResponse.items.length > 0) {
        allVideos = allVideos.concat(nextPageResponse.items);
        nextPageToken = nextPageResponse.nextPageToken;
        pageCount++;
      } else {
        break;
      }
    }
    
    process.stderr.write(`Total videos checked: ${allVideos.length} (API Key)\n`);
    
    if (allVideos.length > 0) {
      // 予約配信（liveBroadcastContent: 'upcoming'）を優先的に探す
      const upcomingVideo = allVideos.find(item => {
        const broadcastContent = item.snippet?.liveBroadcastContent;
        return broadcastContent === 'upcoming';
      });
      
      if (upcomingVideo) {
        const videoId = upcomingVideo.id?.videoId;
        process.stderr.write(`Found upcoming stream: ${videoId}\n`);
        if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
          return {
            liveStreamId: videoId,
            isLive: false,
            latestVideoId: videoId,
            channelId: channelId
          };
        }
      }
      
      // 予約配信が見つからない場合、videos APIで最新の動画IDを直接確認
      // 最新の動画IDを取得して、その動画が予約配信かどうか確認
      const firstVideoId = latestVideoResponse.items[0].id?.videoId;
      if (firstVideoId && firstVideoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(firstVideoId)) {
        try {
          const videoDetails = await youtubeApiRequest('videos', {
            part: 'id,snippet,liveStreamingDetails',
            id: firstVideoId,
            key: apiKey
          });
          
          if (videoDetails.items && videoDetails.items.length > 0) {
            const video = videoDetails.items[0];
            if (video.snippet?.liveBroadcastContent === 'upcoming') {
              process.stderr.write(`Found upcoming stream via videos API: ${firstVideoId}\n`);
              return {
                liveStreamId: firstVideoId,
                isLive: false,
                latestVideoId: firstVideoId,
                channelId: channelId
              };
            }
          }
        } catch (e) {
          process.stderr.write(`Error checking video details: ${e.message}\n`);
        }
      }
      
      // それでも見つからない場合、最新の動画を返す
      process.stderr.write(`No upcoming stream found in ${latestVideoResponse.items.length} videos\n`);
      
      // 予約配信がない場合、最新の動画を取得
      const firstVideo = latestVideoResponse.items[0];
      const videoId = firstVideo.id?.videoId;
      // 動画IDの形式を検証（通常11文字の英数字）
      if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        return {
          liveStreamId: '',
          isLive: false,
          latestVideoId: videoId,
          channelId: channelId
        };
      } else {
        process.stderr.write(`Warning: Invalid video ID format: ${videoId}\n`);
        process.stderr.write(`Full response item: ${JSON.stringify(firstVideo, null, 2)}\n`);
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
  const upcomingStreamId = env.NEXT_PUBLIC_YOUTUBE_UPCOMING_STREAM_ID;

  // 予約配信IDが.envに設定されている場合は、それを優先的に使用
  if (upcomingStreamId && upcomingStreamId.trim() !== '') {
    const videoId = upcomingStreamId.trim();
    if (videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
      process.stderr.write(`Using upcoming stream ID from .env: ${videoId}\n`);
      // videos APIで確認
      if (apiKey && apiKey.trim() !== '') {
        try {
          const videoDetails = await youtubeApiRequest('videos', {
            part: 'id,snippet,liveStreamingDetails',
            id: videoId,
            key: apiKey
          });
          
          if (videoDetails.items && videoDetails.items.length > 0) {
            const video = videoDetails.items[0];
            const broadcastContent = video.snippet?.liveBroadcastContent;
            
            // 配信中か予約配信かを確認
            if (broadcastContent === 'live') {
              process.stderr.write(`Confirmed live stream: ${videoId}\n`);
              const result = {
                liveStreamId: videoId,
                isLive: true,
                latestVideoId: videoId,
                channelId: video.snippet?.channelId || ''
              };
              process.stdout.write(JSON.stringify(result) + '\n');
              process.exit(0);
            } else if (broadcastContent === 'upcoming') {
              process.stderr.write(`Confirmed upcoming stream: ${videoId}\n`);
              const result = {
                liveStreamId: videoId,
                isLive: false,
                latestVideoId: videoId,
                channelId: video.snippet?.channelId || ''
              };
              process.stdout.write(JSON.stringify(result) + '\n');
              process.exit(0);
            } else {
              // 配信でも予約配信でもない場合でも、設定されているIDを返す
              process.stderr.write(`Video ${videoId} is not live or upcoming (broadcast: ${broadcastContent}), but using it anyway\n`);
              const result = {
                liveStreamId: videoId,
                isLive: false,
                latestVideoId: videoId,
                channelId: video.snippet?.channelId || ''
              };
              process.stdout.write(JSON.stringify(result) + '\n');
              process.exit(0);
            }
          }
        } catch (e) {
          process.stderr.write(`Warning: Could not verify upcoming stream ID: ${e.message}\n`);
          // 検証に失敗しても、設定されているIDを返す
          const result = {
            liveStreamId: videoId,
            isLive: false,
            latestVideoId: videoId,
            channelId: ''
          };
          process.stdout.write(JSON.stringify(result) + '\n');
          process.exit(0);
        }
      } else {
        // API Keyがない場合でも、設定されているIDを返す
        const result = {
          liveStreamId: videoId,
          isLive: false,
          latestVideoId: videoId,
          channelId: ''
        };
        process.stdout.write(JSON.stringify(result) + '\n');
        process.exit(0);
      }
    }
  }

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
