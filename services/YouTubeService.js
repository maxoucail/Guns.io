/**
 * link2me — YouTube Music Service (via Invidious)
 * Search YouTube videos for profile music embeds
 */
'use strict';

const axios = require('axios');

const INSTANCES = [
  'https://invidious.slipfox.xyz',
  'https://invidious.protokolla.fi',
];

class YouTubeService {
  constructor() {
    this.client = axios.create({ timeout: 6000 });
  }

  async search(query, limit = 8) {
    if (!query || query.length < 2) return [];
    for (const base of INSTANCES) {
      try {
        const { data } = await this.client.get(`${base}/api/v1/search`, {
          params: { q: query, type: 'video' },
        });
        const items = Array.isArray(data) ? data : [];
        return items
          .filter(v => v.videoId && v.type === 'video')
          .slice(0, limit)
          .map(v => ({
            id: 'yt_' + v.videoId,
            title: v.title || '',
            artist: v.author || '',
            cover: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
            preview: 'https://www.youtube.com/embed/' + v.videoId,
            source: 'youtube',
          }));
      } catch (err) {
        console.warn(`[YouTube] ${base} failed:`, err.message);
      }
    }
    return [];
  }
}

module.exports = new YouTubeService();
