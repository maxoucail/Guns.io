'use strict';

const axios = require('axios');
const Logger = require('../utils/Logger');

class YouTubeService {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    this.client = axios.create({ baseURL: 'https://www.googleapis.com/youtube/v3', timeout: 8000 });
  }

  isConfigured() { return !!this.apiKey; }

  async search(query, limit = 8) {
    if (!this.isConfigured() || !query || query.length < 2) return [];
    try {
      const { data } = await this.client.get('/search', {
        params: {
          part: 'snippet',
          type: 'video',
          videoCategoryId: '10',
          videoEmbeddable: 'true',
          q: query,
          key: this.apiKey,
          maxResults: limit
        }
      });
      return (data.items || [])
        .filter(item => item.id?.videoId)
        .map(item => ({
          id: 'yt_' + item.id.videoId,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          cover: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || null,
          preview: 'https://www.youtube.com/embed/' + item.id.videoId,
          source: 'youtube'
        }));
    } catch (err) {
      Logger.warn('YouTubeService.search a échoué', err.message);
      return [];
    }
  }
}

module.exports = new YouTubeService();
