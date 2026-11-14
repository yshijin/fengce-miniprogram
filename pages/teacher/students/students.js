const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    classes: [],
    currentClassId: '',
    currentClassName: '',
    keyword: '',
    students: [],
    totalCount: 0,
    showAdd: false,
    form: { no: '', name: '', major: '软件工程', adminClass: '' },
    classNames: [],
    classIndex: 0,
    submitting: false
  },

  onShow() {
    this.load(false);
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load(force) {
    if (!force) this.setData({ loading: !this.data.user, error: '' });
    return api.loadBootstrap(force).then((boot) => {
      const classes = boot.classes || [];
      if (!classes.length) {
        this.setData({ loading: false, error: '当前账号还没有负责的教学班', user: boot.user });
        return;
      }
      let current = api.getCurrentClassId();
      if (!data.findClass(boot, current)) {
        current = boot.user.classId && data.findClass(boot, boot.user.classId) ? boot.user.classId : classes[0].id;
        api.setCurrentClassId(current);
      }
      this.boot = boot;
      this.setData({ loading: false, error: '', user: boot.user, classes: classes });
      this.render(boot, current);
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载学生失败' });
    });
  },

  render(boot, classId) {
    const cls = data.findClass(boot, classId);
    const papers = data.teacherPapers(boot, classId);
    const paperIds = {};
    papers.forEach((p) => { paperIds[p.id] = true; });
    const keyword = String(this.data.keyword || '').trim().toLowerCase();
    const all = data.teacherStudents(boot, classId);
    const list = all.filter((s) => {
      if (!keyword) return true;
      return String(s.name || '').toLowerCase().indexOf(keyword) >= 0 ||
        String(s.no || '').toLowerCase().indexOf(keyword) >= 0 ||
        String(s.adminClass || '').toLowerCase().indexOf(keyword) >= 0;
    }).map((s) => {
      const attempts = (boot.attempts || []).filter((a) => {
        return a.studentId === s.id && paperIds[a.paperId] && a.status === 'submitted';
      });
      const last = attempts.length ? attempts.reduce((a, b) => {
        return data.parseTime(b.submittedAt) > data.parseTime(a.submittedAt) ? b : a;
      }) : null;
      const clsInfo = data.findClass(boot, s.classId);
      return {
        id: s.id,
        no: s.no,
        name: s.name,
        className: clsInfo ? clsInfo.name : '—',
        major: s.major || '—',
        adminClass: s.adminClass || '—',
        status: s.status === 'active' ? '在读' : (s.status || '—'),
        initial: String(s.name || '?').substring(0, 1),
        attemptCount: attempts.length,
        avg: data.avgPct(attempts),
        lastActive: last ? data.formatDate(last.submittedAt, true) : '暂无'
      };
    }).sort((a, b) => String(a.no || '').localeCompare(String(b.no || '')));

    this.setData({
      currentClassId: classId,
      currentClassName: cls ? cls.name : '',
      students: list,
      totalCount: all.length,
      classNames: (boot.classes || []).map((c) => c.name + '（' + (c.count || 0) + '人）')
    });
  },

  onClassChange(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    api.setCurrentClassId(id);
    if (this.boot) this.render(this.boot, id);
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    if (this.boot) this.render(this.boot, this.data.currentClassId);
  },

  clearSearch() {
    this.setData({ keyword: '' });
    if (this.boot) this.render(this.boot, this.data.currentClassId);
  },

  openAdd() {
    const classes = this.data.classes || [];
    let index = 0;
    for (let i = 0; i < classes.length; i++) {
      if (classes[i].id === this.data.currentClassId) index = i;
    }
    this.setData({
      showAdd: true,
      classIndex: index,
      form: { no: '', name: '', major: '软件工程', adminClass: '' }
    });
  },

  closeAdd() {
    if (this.data.submitting) return;
    this.setData({ showAdd: false });
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['form.' + field] = e.detail.value;
    this.setData(patch);
  },

  onClassPick(e) {
    this.setData({ classIndex: Number(e.detail.value) || 0 });
  },

  submitAdd() {
    if (this.data.submitting) return;
    const no = String(this.data.form.no || '').trim();
    const name = String(this.data.form.name || '').trim();
    const cls = this.data.classes[this.data.classIndex];
    if (!no || !name) {
      wx.showToast({ title: '请填写学号和姓名', icon: 'none' });
      return;
    }
    if (!cls) {
      wx.showToast({ title: '请选择教学班', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    api.addStudent({
      no: no,
      name: name,
      classId: cls.id,
      major: this.data.form.major,
      adminClass: this.data.form.adminClass || cls.name
    }).then(() => {
      api.setCurrentClassId(cls.id);
      this.setData({ showAdd: false, submitting: false });
      wx.showToast({ title: '已添加学生', icon: 'success' });
      return this.load(true);
    }).catch((err) => {
      this.setData({ submitting: false });
      wx.showModal({
        title: '添加失败',
        content: err.message || '请检查学号是否已存在',
        showCancel: false
      });
    });
  },

  reload() {
    this.load(true);
  }
});
