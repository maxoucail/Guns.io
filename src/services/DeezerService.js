'use strict';

const axios = require('axios');
const Logger = require('../utils/Logger');

/**
 * Deezer fournit une API publique sans clé, avec previews 30s.
 * Les previews de 30s sont autorisées pour intégration publique côté
 * client (lecture en streaming depuis cdns-preview-*.dzcdn.net) tant
 * qu'on n'archive pas le fichier. C'est l'équivalent légal du sample
 * sur Spotify / Apple Music.
 */
class DeezerService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.deezer.com',
      timeout: 8000
    });
  }

  async search(query, limit = 15) {
    if (!query || query.length < 2) return [];
    try {
      const { data } = await this.client.get('/search', {
        params: { q: query, limit }
      });
      if (!data?.data) return [];
      return data.data
        .filter((t) => t.preview)
        .map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist?.name || '',
          album: t.album?.title || '',
          cover: t.album?.cover_medium || t.album?.cover || null,
          preview: t.preview,
          duration: t.duration
        }));
    } catch (err) {
      Logger.warn('DeezerService.search a échoué', err.message);
      return [];
    }
  }

  async track(id) {
    try {
      const { data } = await this.client.get(`/track/${id}`);
      if (!data || data.error) return null;
      return {
        id: data.id,
        title: data.title,
        artist: data.artist?.name || '',
        album: data.album?.title || '',
        cover: data.album?.cover_medium || null,
        preview: data.preview,
        duration: data.duration
      };
    } catch (err) {
      Logger.warn('DeezerService.track a échoué', err.message);
      return null;
    }
  }
}

module.exports = new DeezerService();
