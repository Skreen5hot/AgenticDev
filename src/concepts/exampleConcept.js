/**
 * Example Concept - Template for Creating New Concepts
 *
 * This is a sample concept that demonstrates the Concepts + Synchronizations pattern.
 * Replace this with your own business logic concepts.
 *
 * Key Principles:
 * 1. Concepts are singletons with explicit state
 * 2. Actions contain pure business logic
 * 3. State changes trigger events via notify()
 * 4. Concepts are independent and composable
 */

export const exampleConcept = {
  /**
   * State object - all mutable data lives here
   * Always reset this in test beforeEach hooks
   */
  state: {
    items: [],
    selectedItem: null,
    isLoading: false,
    errorMessage: null
  },

  /**
   * Actions - pure functions that manipulate state
   */
  actions: {
    /**
     * Add an item to the collection
     * @param {Object} item - Item to add
     * @returns {Object} The added item with generated ID
     */
    addItem(item) {
      const self = exampleConcept;

      // Validate input
      if (!item || !item.name) {
        throw new Error('Item must have a name property');
      }

      // Generate ID if not provided
      const newItem = {
        id: item.id || Date.now(),
        name: item.name,
        createdAt: new Date().toISOString(),
        ...item
      };

      // Update state
      self.state.items.push(newItem);

      // Notify subscribers
      self.notify('itemAdded', { item: newItem });

      return newItem;
    },

    /**
     * Remove an item by ID
     * @param {number|string} id - Item ID to remove
     * @returns {boolean} True if item was removed
     */
    removeItem(id) {
      const self = exampleConcept;
      const initialLength = self.state.items.length;

      self.state.items = self.state.items.filter(item => item.id !== id);

      const wasRemoved = self.state.items.length < initialLength;

      if (wasRemoved) {
        self.notify('itemRemoved', { id });
      }

      return wasRemoved;
    },

    /**
     * Select an item by ID
     * @param {number|string} id - Item ID to select
     */
    selectItem(id) {
      const self = exampleConcept;
      const item = self.state.items.find(item => item.id === id);

      if (!item) {
        throw new Error(`Item with id ${id} not found`);
      }

      self.state.selectedItem = item;
      self.notify('itemSelected', { item });
    },

    /**
     * Clear selection
     */
    clearSelection() {
      const self = exampleConcept;
      self.state.selectedItem = null;
      self.notify('selectionCleared');
    },

    /**
     * Get all items
     * @returns {Array} Copy of items array
     */
    getItems() {
      const self = exampleConcept;
      return [...self.state.items];
    },

    /**
     * Get item by ID
     * @param {number|string} id - Item ID
     * @returns {Object|null} Item or null if not found
     */
    getItemById(id) {
      const self = exampleConcept;
      return self.state.items.find(item => item.id === id) || null;
    },

    /**
     * Simulate async operation (e.g., API call)
     * @param {number} delay - Delay in milliseconds
     * @returns {Promise<Array>} Items after delay
     */
    async loadItems(delay = 100) {
      const self = exampleConcept;

      self.state.isLoading = true;
      self.notify('loadingStarted');

      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, delay));

        // In real app, this would fetch from API
        const items = [
          { id: 1, name: 'Sample Item 1' },
          { id: 2, name: 'Sample Item 2' }
        ];

        self.state.items = items;
        self.state.isLoading = false;
        self.state.errorMessage = null;

        self.notify('itemsLoaded', { items });

        return items;
      } catch (error) {
        self.state.isLoading = false;
        self.state.errorMessage = error.message;
        self.notify('loadingFailed', { error: error.message });
        throw error;
      }
    },

    /**
     * Reset concept to initial state
     * Useful for testing and cleanup
     */
    reset() {
      const self = exampleConcept;
      self.state.items = [];
      self.state.selectedItem = null;
      self.state.isLoading = false;
      self.state.errorMessage = null;
      self.notify('reset');
    }
  },

  /**
   * Event subscription system
   * Allows other concepts to react to state changes
   */
  _subscribers: [],

  /**
   * Notify all subscribers of an event
   * @param {string} event - Event name
   * @param {Object} payload - Event data
   */
  notify(event, payload = {}) {
    this._subscribers.forEach(fn => fn(event, payload));
  },

  /**
   * Subscribe to events
   * @param {Function} fn - Callback function (event, payload) => void
   */
  subscribe(fn) {
    this._subscribers.push(fn);
  },

  /**
   * Unsubscribe from events
   * @param {Function} fn - Callback function to remove
   */
  unsubscribe(fn) {
    this._subscribers = this._subscribers.filter(sub => sub !== fn);
  }
};
