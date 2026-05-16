'use strict';

const axios = require('axios');
const Logger = require('../utils/Logger');

class SoundCloudService {
  constructor() {
    this.clientId = process.env.SOUNDCLOUD_CLIENT_ID || '';
    this.client = axios.create({ baseURL: 'https://api.soundcloud.com', timeout: 8000 });
  }

  isConfigured() { return !!this.clientId; }

  async search(query, limit = 8) {
    if (!this.isConfigured() || !query || query.length < 2) return [];
    try {
      const { data } = await this.client.get('/tracks', {
        params: { q: query, client_id: this.clientId, limit }
      });
      const tracks = Array.isArray(data) ? data : (data.collection || []);
      return tracks
        .filter(t => t.streamable && t.stream_url)
        .map(t => ({
          id: 'sc_' + t.id,
          title: t.title,
          artist: t.user?.username || '',
          album: '',
          cover: t.artwork_url ? t.artwork_url.replace('-large', '-t300x300') : null,
          preview: t.stream_url + '?client_id=' + this.clientId,
          duration: Math.round((t.duration || 0) / 1000),
          source: 'soundcloud'
        }));
    } catch (err) {
      Logger.warn('SoundCloudService.search a échoué', err.message);
      return [];
    }
  }
}

module.exports = new SoundCloudService();
