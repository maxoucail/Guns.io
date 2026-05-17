'use strict';

const axios = require('axios');
const Logger = require('../utils/Logger');

const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.cdaut.de',
  'https://invidious.privacydev.net',
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
          params: { q: query, type: 'video' }
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
            source: 'youtube'
          }));
      } catch (err) {
        Logger.warn(`Invidious ${base} échoué`, err.message);
      }
    }
    return [];
  }
}

module.exports = new YouTubeService();
