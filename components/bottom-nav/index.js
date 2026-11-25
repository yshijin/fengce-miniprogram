const NAV = {
  student: [
    { url: '/pages/student/home/home', label: '评测', icon: '评' },
    { url: '/pages/student/history/history', label: '记录', icon: '录' },
    { url: '/pages/student/wrongbook/wrongbook', label: '错题', icon: '错' },
    { url: '/pages/mine/mine', label: '我的', icon: '我' }
  ],
  teacher: [
    { url: '/pages/teacher/home/home', label: '控制台', icon: '控' },
    { url: '/pages/teacher/students/students', label: '学员', icon: '学' },
    { url: '/pages/teacher/papers/papers', label: '任务', icon: '任' },
    { url: '/pages/teacher/data/data', label: '分析', icon: '析' },
    { url: '/pages/mine/mine', label: '我的', icon: '我' }
  ],
  course_leader: [
    { url: '/pages/cl/home/home', label: '总览', icon: '览' },
    { url: '/pages/cl/manage/manage', label: '组织', icon: '组' },
    { url: '/pages/cl/papers/papers', label: '评测', icon: '评' },
    { url: '/pages/cl/bank/bank', label: '题库', icon: '题' },
    { url: '/pages/mine/mine', label: '我的', icon: '我' }
  ]
};

Component({
  properties: {
    role: {
      type: String,
      value: 'student'
    },
    active: {
      type: String,
      value: ''
    }
  },

  data: {
    items: NAV.student
  },

  lifetimes: {
    attached() {
      this.refresh();
    }
  },

  observers: {
    role() {
      this.refresh();
    }
  },

  methods: {
    refresh() {
      const role = this.data.role;
      this.setData({ items: NAV[role] || NAV.student });
    },

    go(e) {
      const url = e.currentTarget.dataset.url;
      if (!url || url === this.data.active) return;
      wx.reLaunch({ url: url });
    }
  }
});
