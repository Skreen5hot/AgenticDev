/**
 * Storage Concept - User-Owned Data with IndexedDB
 *
 * This concept demonstrates edge computing principles:
 * - All user data stored locally in IndexedDB
 * - No server dependency for CRUD operations
 * - Offline-first architecture
 * - User owns and controls their data
 * - Optional sync to server when online
 *
 * IndexedDB provides:
 * - Large storage capacity (50MB+ typical, can request more)
 * - Structured data with indexes
 * - Transactional operations
 * - Async API (non-blocking)
 */

export const storageConcept = {
  /**
   * State - Connection and metadata
   */
  state: {
    db: null,
    dbName: 'agentic-app-db',
    dbVersion: 1,
    isOpen: false,
    stores: {}, // Track object stores
    error: null,
    pendingSyncs: [] // Operations waiting to sync to server
  },

  /**
   * Actions - IndexedDB operations
   */
  actions: {
    /**
     * Initialize IndexedDB
     * Creates database and object stores
     */
    async init(config = {}) {
      const self = storageConcept;

      try {
        // Validate IndexedDB support
        if (!self.actions.isSupported()) {
          throw new Error('IndexedDB is not supported in this browser');
        }

        const dbName = config.dbName || self.state.dbName;
        const dbVersion = config.dbVersion || self.state.dbVersion;

        // Open database connection
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName, dbVersion);

          request.onerror = () => {
            reject(new Error(`Failed to open database: ${request.error}`));
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('data')) {
              const dataStore = db.createObjectStore('data', {
                keyPath: 'id',
                autoIncrement: true
              });
              // Create indexes for efficient querying
              dataStore.createIndex('timestamp', 'timestamp', { unique: false });
              dataStore.createIndex('type', 'type', { unique: false });
              dataStore.createIndex('userId', 'userId', { unique: false });
            }

            // Create sync queue store for offline operations
            if (!db.objectStoreNames.contains('syncQueue')) {
              const syncStore = db.createObjectStore('syncQueue', {
                keyPath: 'queueId',
                autoIncrement: true
              });
              syncStore.createIndex('timestamp', 'timestamp', { unique: false });
              syncStore.createIndex('status', 'status', { unique: false });
            }

            console.log('[Storage] Database schema upgraded to version', dbVersion);
          };
        });

        self.state.db = db;
        self.state.isOpen = true;
        self.state.error = null;

        // Track available stores
        const storeNames = Array.from(db.objectStoreNames);
        storeNames.forEach(name => {
          self.state.stores[name] = true;
        });

        self.notify('initialized', { dbName, dbVersion, stores: storeNames });
        console.log('[Storage] Database initialized:', dbName);

        return db;
      } catch (error) {
        self.state.error = error.message;
        self.notify('initializationFailed', { error });
        throw error;
      }
    },

    /**
     * Check if IndexedDB is supported
     */
    isSupported() {
      return typeof indexedDB !== 'undefined';
    },

    /**
     * Create (add) a new record
     */
    async create(storeName, data) {
      const self = storageConcept;

      if (!self.state.isOpen) {
        throw new Error('Database not initialized. Call init() first.');
      }

      try {
        // Add metadata
        const record = {
          ...data,
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
          synced: false
        };

        const id = await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.add(record);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error(`Failed to create record: ${request.error}`));
        });

        record.id = id;
        self.notify('recordCreated', { storeName, record });

        // Queue for sync if needed
        if (data.syncToServer) {
          await self.actions.queueSync('create', storeName, record);
        }

        return record;
      } catch (error) {
        self.notify('createFailed', { storeName, error });
        throw error;
      }
    },

    /**
     * Read a single record by ID
     */
    async read(storeName, id) {
      const self = storageConcept;

      if (!self.state.isOpen) {
        throw new Error('Database not initialized. Call init() first.');
      }

      try {
        const record = await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.get(id);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error(`Failed to read record: ${request.error}`));
        });

        self.notify('recordRead', { storeName, id, found: !!record });
        return record || null;
      } catch (error) {
        self.notify('readFailed', { storeName, id, error });
        throw error;
      }
    },

    /**
     * Read all records from a store
     */
    async readAll(storeName, options = {}) {
      const self = storageConcept;

      if (!self.state.isOpen) {
        throw new Error('Database not initialized. Call init() first.');
      }

      try {
        const records = await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.getAll();

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error(`Failed to read records: ${request.error}`));
        });

        // Apply filters if provided
        let filteredRecords = records;

        if (options.filter) {
          filteredRecords = records.filter(options.filter);
        }

        // Apply sorting if provided
        if (options.sort) {
          filteredRecords.sort(options.sort);
        }

        // Apply limit if provided
        if (options.limit) {
          filteredRecords = filteredRecords.slice(0, options.limit);
        }

        self.notify('recordsRead', { storeName, count: filteredRecords.length });
        return filteredRecords;
      } catch (error) {
        self.notify('readAllFailed', { storeName, error });
        throw error;
      }
    },

    /**
     * Query records by index
     */
    async query(storeName, indexName, value) {
      const self = storageConcept;

      if (!self.state.isOpen) {
        throw new Error('Database not initialized. Call init() first.');
      }

      try {
        const records = await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const index = store.index(indexName);
          const request = index.getAll(value);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error(`Failed to query records: ${request.error}`));
        });

        self.notify('recordsQueried', { storeName, indexName, value, count: records.length });
        return records;
      } catch (error) {
        self.notify('queryFailed', { storeName, indexName, value, error });
        throw error;
      }
    },

    /**
     * Update an existing record
     */
    async update(storeName, id, updates) {
      const self = storageConcept;

      if (!self.state.isOpen) {
        throw new Error('Database not initialized. Call init() first.');
      }

      try {
        // Read existing record
        const existing = await self.actions.read(storeName, id);
        if (!existing) {
          throw new Error(`Record not found: ${id}`);
        }

        // Merge updates
        const updated = {
          ...existing,
          ...updates,
          id, // Preserve ID
          updatedAt: new Date().toISOString(),
          synced: false
        };

        await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.put(updated);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error(`Failed to update record: ${request.error}`));
        });

        self.notify('recordUpdated', { storeName, id, updates });

        // Queue for sync if needed
        if (updates.syncToServer) {
          await self.actions.queueSync('update', storeName, updated);
        }

        return updated;
      } catch (error) {
        self.notify('updateFailed', { storeName, id, error });
        throw error;
      }
    },

    /**
     * Delete a record
     */
    async delete(storeName, id) {
      const self = storageConcept;

      if (!self.state.isOpen) {
        throw new Error('Database not initialized. Call init() first.');
      }

      try {
        await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.delete(id);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(new Error(`Failed to delete record: ${request.error}`));
        });

        self.notify('recordDeleted', { storeName, id });

        // Queue for sync if needed
        await self.actions.queueSync('delete', storeName, { id });

        return true;
      } catch (error) {
        self.notify('deleteFailed', { storeName, id, error });
        throw error;
      }
    },

    /**
     * Clear all records from a store
     */
    async clear(storeName) {
      const self = storageConcept;

      if (!self.state.isOpen) {
        throw new Error('Database not initialized. Call init() first.');
      }

      try {
        await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.clear();

          request.onsuccess = () => resolve();
          request.onerror = () => reject(new Error(`Failed to clear store: ${request.error}`));
        });

        self.notify('storeCleared', { storeName });
        return true;
      } catch (error) {
        self.notify('clearFailed', { storeName, error });
        throw error;
      }
    },

    /**
     * Queue an operation for server sync
     * Implements edge computing: work offline, sync later
     */
    async queueSync(operation, storeName, data) {
      const self = storageConcept;

      const queueItem = {
        operation,
        storeName,
        data,
        timestamp: Date.now(),
        status: 'pending',
        retries: 0
      };

      try {
        const queueId = await new Promise((resolve, reject) => {
          const transaction = self.state.db.transaction(['syncQueue'], 'readwrite');
          const store = transaction.objectStore('syncQueue');
          const request = store.add(queueItem);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error(`Failed to queue sync: ${request.error}`));
        });

        queueItem.queueId = queueId;
        self.state.pendingSyncs.push(queueItem);
        self.notify('syncQueued', { queueItem });

        return queueId;
      } catch (error) {
        self.notify('queueSyncFailed', { error });
        throw error;
      }
    },

    /**
     * Process sync queue (call when online)
     */
    async processSyncQueue() {
      const self = storageConcept;

      try {
        const queue = await self.actions.readAll('syncQueue', {
          filter: item => item.status === 'pending'
        });

        console.log(`[Storage] Processing ${queue.length} queued operations`);

        for (const item of queue) {
          try {
            // This is where you'd make API calls to sync with server
            // For template purposes, we'll just mark as synced
            console.log(`[Storage] Syncing ${item.operation} for ${item.storeName}`);

            // Update sync queue item
            await self.actions.update('syncQueue', item.queueId, {
              status: 'synced',
              syncedAt: new Date().toISOString()
            });

            // Update original record
            if (item.data.id) {
              await self.actions.update(item.storeName, item.data.id, {
                synced: true
              });
            }
          } catch (error) {
            console.error(`[Storage] Sync failed for item ${item.queueId}:`, error);

            // Update retry count
            await self.actions.update('syncQueue', item.queueId, {
              retries: item.retries + 1,
              lastError: error.message
            });
          }
        }

        self.notify('syncQueueProcessed', { processed: queue.length });
      } catch (error) {
        self.notify('syncQueueProcessFailed', { error });
        throw error;
      }
    },

    /**
     * Close database connection
     */
    close() {
      const self = storageConcept;

      if (self.state.db) {
        self.state.db.close();
        self.state.db = null;
        self.state.isOpen = false;
        self.notify('closed');
        console.log('[Storage] Database closed');
      }
    },

    /**
     * Reset state (for testing)
     */
    reset() {
      const self = storageConcept;
      self.actions.close();
      self.state.stores = {};
      self.state.error = null;
      self.state.pendingSyncs = [];
      self._subscribers = [];
    }
  },

  /**
   * Event System
   */
  _subscribers: [],

  notify(event, payload = {}) {
    this._subscribers.forEach(fn => fn(event, payload));
  },

  subscribe(fn) {
    this._subscribers.push(fn);
  },

  unsubscribe(fn) {
    this._subscribers = this._subscribers.filter(sub => sub !== fn);
  }
};
