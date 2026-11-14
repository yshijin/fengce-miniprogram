Component({
  properties: {
    classes: {
      type: Array,
      value: []
    },
    current: {
      type: String,
      value: ''
    }
  },

  methods: {
    change(e) {
      const id = e.currentTarget.dataset.id;
      if (!id || id === this.data.current) return;
      this.triggerEvent('change', { id: id });
    }
  }
});
