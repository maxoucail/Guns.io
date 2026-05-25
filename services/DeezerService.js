/**
 * link2me — Deezer Music Service
 * Search tracks via Deezer API (free, no key needed)
 */
'use strict';

const axios = require('axios');

class DeezerService {
  constructor() {
    this.client = axios.create({ baseURL: 'https://api.deezer.com', timeout: 8000 });
  }

  async search(query, limit = 15) {
    if (!query || query.length < 2) return [];
    try {
      const { data } = await this.client.get('/search', { params: { q: query, limit } });
      if (!data?.data) return [];
      return data.data.filter(t => t.preview).map(t => ({
        id: t.id,
        title: t.title || '',
        artist: t.artist?.name || '',
        album: t.album?.title || '',
        cover: t.album?.cover_medium || t.album?.cover || null,
        preview: t.preview,
        duration: t.duration,
        source: 'deezer',
      }));
    } catch (err) {
      console.warn('[Deezer] Search failed:', err.message);
      return [];
    }
  }

  async track(id) {
    try {
      const { data } = await this.client.get(`/track/${id}`);
      if (!data || data.error) return null;
      return {
        id: data.id, title: data.title, artist: data.artist?.name || '',
        album: data.album?.title || '', cover: data.album?.cover_medium || null,
        preview: data.preview, duration: data.duration,
      };
    } catch (err) {
      console.warn('[Deezer] Track lookup failed:', err.message);
      return null;
    }
  }
}

module.exports = new DeezerService();
