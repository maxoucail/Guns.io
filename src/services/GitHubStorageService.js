'use strict';

const axios = require('axios');
const Logger = require('../utils/Logger');

const GH_API = 'https://api.github.com';
const MAX_BYTES = 98 * 1024 * 1024; // 98 MB

class GitHubStorageService {
  constructor() {
    this.owner  = process.env.GITHUB_OWNER  || '';
    this.repo   = process.env.GITHUB_REPO   || '';
    this.branch = process.env.GITHUB_UPLOADS_BRANCH || 'uploads';
    this.token  = process.env.GITHUB_TOKEN  || '';
    this._branchReady = false;

    this.client = axios.create({
      baseURL: GH_API,
      timeout: 120_000,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      }
    });
  }

  isConfigured() {
    return !!(this.owner && this.repo && this.token);
  }

  // Public : push un Buffer vers {branch}/{ghPath}, retourne l'URL raw
  async upload(buffer, ghPath) {
    if (!this.isConfigured()) throw new Error('GitHub storage non configuré');
    if (buffer.length > MAX_BYTES) throw new Error(`Fichier trop lourd (max 98 Mo)`);

    await this._ensureBranch();

    // Crée le blob (Git Object Store — supporte jusqu'à ~100 Mo)
    const blob = await this._createBlob(buffer);

    // Commit avec retry en cas de conflit fast-forward
    let lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        const ref    = await this._getRef();
        const commit = await this._getCommit(ref.object.sha);
        const tree   = await this._createTree(commit.tree.sha, ghPath, blob.sha);
        const nc     = await this._createCommit(`upload: ${ghPath.split('/').pop()}`, tree.sha, ref.object.sha);
        await this._updateRef(nc.sha);
        break;
      } catch (err) {
        // 422 = conflict (un autre worker a avancé le ref en même temps)
        if (err.response?.status === 422 && i < 3) {
          await new Promise(r => setTimeout(r, 600 * (i + 1)));
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    if (lastErr) throw lastErr;

    // Délai CDN minimal avant que raw.githubusercontent.com serve le fichier
    return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${ghPath}`;
  }

  // Crée la branche "uploads" si elle n'existe pas encore
  async _ensureBranch() {
    if (this._branchReady) return;
    try {
      await this.client.get(`/repos/${this.owner}/${this.repo}/git/ref/heads/${this.branch}`);
      this._branchReady = true;
    } catch (err) {
      if (err.response?.status !== 404) throw err;
      // Récupère le SHA de la branche par défaut pour créer la nôtre à partir de là
      const { data: repo } = await this.client.get(`/repos/${this.owner}/${this.repo}`);
      const { data: mainRef } = await this.client.get(
        `/repos/${this.owner}/${this.repo}/git/ref/heads/${repo.default_branch}`
      );
      await this.client.post(`/repos/${this.owner}/${this.repo}/git/refs`, {
        ref: `refs/heads/${this.branch}`,
        sha: mainRef.object.sha
      });
      Logger.info(`GitHubStorage: branche '${this.branch}' créée`);
      this._branchReady = true;
    }
  }

  async _createBlob(buffer) {
    const { data } = await this.client.post(
      `/repos/${this.owner}/${this.repo}/git/blobs`,
      { content: buffer.toString('base64'), encoding: 'base64' }
    );
    return data;
  }

  async _getRef() {
    const { data } = await this.client.get(
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${this.branch}`
    );
    return data;
  }

  async _getCommit(sha) {
    const { data } = await this.client.get(
      `/repos/${this.owner}/${this.repo}/git/commits/${sha}`
    );
    return data;
  }

  async _createTree(baseTree, filePath, blobSha) {
    const { data } = await this.client.post(
      `/repos/${this.owner}/${this.repo}/git/trees`,
      {
        base_tree: baseTree,
        tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blobSha }]
      }
    );
    return data;
  }

  async _createCommit(message, treeSha, parentSha) {
    const { data } = await this.client.post(
      `/repos/${this.owner}/${this.repo}/git/commits`,
      { message, tree: treeSha, parents: [parentSha] }
    );
    return data;
  }

  async _updateRef(sha) {
    await this.client.patch(
      `/repos/${this.owner}/${this.repo}/git/refs/heads/${this.branch}`,
      { sha, force: false }
    );
  }
}

module.exports = new GitHubStorageService();
