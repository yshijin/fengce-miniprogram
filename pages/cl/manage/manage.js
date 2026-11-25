const api = require('../../../utils/api');
const data = require('../../../utils/data');

function initialOf(value) {
  return String(value || '?').substring(0, 1);
}

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    activeTab: 'courses',
    courses: [],
    classes: [],
    teachers: [],
    students: [],
    logs: [],
    counts: { courses: 0, classes: 0, teachers: 0, students: 0, papers: 0 },
    keyword: '',
    showCourse: false,
    courseForm: { name: '', code: '', term: '' },
    showClass: false,
    classForm: { name: '', major: '', term: '' },
    teacherNames: [],
    teacherIndex: 0,
    showTeacher: false,
    teacherForm: { no: '', name: '', phone: '' },
    showStudent: false,
    studentForm: { no: '', name: '', major: '软件工程', adminClass: '' },
    classNames: [],
    studentClassIndex: 0,
    submitting: false
  },

  onShow() {
    this.load(true);
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load(force) {
    if (!force) this.setData({ loading: !this.data.user, error: '' });
    return api.loadBootstrap(force).then((boot) => {
      if (!boot.user || boot.user.role !== 'course_leader') {
        this.setData({ loading: false, error: '当前账号没有组织管理权限', user: boot.user });
        return;
      }
      const allClasses = boot.classes || [];
      const allPapers = boot.papers || [];
      const classMap = {};
      allClasses.forEach((c) => { classMap[c.id] = c; });
      const courseMap = {};
      (boot.courses || []).forEach((c) => { courseMap[c.id] = c; });
      const courses = (boot.courses || []).map((c) => {
        return {
          id: c.id,
          name: c.name,
          code: c.code || '未设置编码',
          term: c.term || '未设置学期',
          owner: c.owner || '—',
          statusLabel: c.status === 'active' ? '运行中' : (c.status || '—'),
          classCount: allClasses.filter((x) => x.courseId === c.id).length,
          isCurrent: c.id === boot.user.courseId,
          initial: initialOf(c.name)
        };
      });
      const classes = allClasses.map((c) => {
        const cs = data.classStats(boot, c.id);
        const paperCount = allPapers.filter((p) => {
          return !p.ownerStudentId && (p.classIds || []).indexOf(c.id) >= 0;
        }).length;
        return {
          id: c.id,
          name: c.name,
          courseName: courseMap[c.courseId] ? courseMap[c.courseId].name : '—',
          teacherName: c.teacherName || '未分配教师',
          major: c.major || '未设置专业',
          term: c.term || '未设置学期',
          studentCount: cs.studentCount,
          paperCount: paperCount,
          participation: cs.participation,
          initial: initialOf(c.name)
        };
      });
      const teachers = (boot.teachers || []).map((t) => {
        return {
          id: t.id,
          no: t.no,
          name: t.name,
          phone: t.phone || '未填写电话',
          classes: t.classes || '暂未分配教学班',
          statusLabel: t.status === 'active' ? '在职' : (t.status || '—'),
          initial: initialOf(t.name)
        };
      });
      const allStudents = (boot.students || []).map((s) => {
        const cls = classMap[s.classId];
        const attempts = (boot.attempts || []).filter((a) => {
          return a.studentId === s.id && a.status === 'submitted';
        });
        const last = attempts.length ? attempts.reduce((a, b) => {
          return data.parseTime(b.submittedAt) > data.parseTime(a.submittedAt) ? b : a;
        }) : null;
        return {
          id: s.id,
          no: s.no,
          name: s.name,
          className: cls ? cls.name : '未分班',
          classId: s.classId || '',
          adminClass: s.adminClass || '—',
          major: s.major || '—',
          statusLabel: s.status === 'active' ? '在读' : (s.status || '—'),
          attemptCount: attempts.length,
          avg: data.avgPct(attempts),
          lastText: last ? data.formatDate(last.submittedAt, true) : '暂无',
          initial: initialOf(s.name)
        };
      });
      const logs = (boot.logs || []).slice(0, 100).map((l) => {
        return {
          id: l.id,
          operator: l.operator,
          role: l.role,
          action: l.action,
          detail: l.detail,
          timeText: data.formatDate(l.time, true)
        };
      });
      this.allStudents = allStudents;
      this.setData({
        loading: false,
        error: '',
        user: boot.user,
        courses: courses,
        classes: classes,
        teachers: teachers,
        students: allStudents,
        logs: logs,
        counts: {
          courses: courses.length,
          classes: classes.length,
          teachers: teachers.length,
          students: allStudents.length,
          papers: allPapers.filter((p) => !p.ownerStudentId).length
        },
        teacherNames: teachers.map((t) => t.name + ' · ' + t.no),
        classNames: classes.map((c) => c.name + ' · ' + c.teacherName),
        keyword: ''
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载组织数据失败' });
    });
  },

  setTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  openCourse() {
    this.setData({
      showCourse: true,
      courseForm: { name: '', code: '', term: '' }
    });
  },

  openClass() {
    if (!this.data.teachers.length) {
      wx.showToast({ title: '请先添加教师', icon: 'none' });
      return;
    }
    this.setData({
      showClass: true,
      teacherIndex: 0,
      classForm: { name: '', major: '', term: '' }
    });
  },

  openTeacher() {
    this.setData({
      showTeacher: true,
      teacherForm: { no: '', name: '', phone: '' }
    });
  },

  openStudent() {
    if (!this.data.classes.length) {
      wx.showToast({ title: '请先创建教学班', icon: 'none' });
      return;
    }
    this.setData({
      showStudent: true,
      studentClassIndex: 0,
      studentForm: { no: '', name: '', major: '软件工程', adminClass: '' }
    });
  },

  closeAll() {
    if (this.data.submitting) return;
    this.setData({
      showCourse: false,
      showClass: false,
      showTeacher: false,
      showStudent: false
    });
  },

  onFormInput(e) {
    const form = e.currentTarget.dataset.form;
    const field = e.currentTarget.dataset.field;
    if (!form || !field) return;
    const patch = {};
    patch[form + '.' + field] = e.detail.value;
    this.setData(patch);
  },

  onTeacherPick(e) {
    this.setData({ teacherIndex: Number(e.detail.value) || 0 });
  },

  onStudentClassPick(e) {
    this.setData({ studentClassIndex: Number(e.detail.value) || 0 });
  },

  onSearch(e) {
    const keyword = String(e.detail.value || '').trim().toLowerCase();
    const list = (this.allStudents || []).filter((s) => {
      if (!keyword) return true;
      return String(s.name || '').toLowerCase().indexOf(keyword) >= 0 ||
        String(s.no || '').toLowerCase().indexOf(keyword) >= 0 ||
        String(s.className || '').toLowerCase().indexOf(keyword) >= 0 ||
        String(s.adminClass || '').toLowerCase().indexOf(keyword) >= 0;
    });
    this.setData({ keyword: e.detail.value, students: list });
  },

  clearSearch() {
    this.setData({ keyword: '', students: this.allStudents || [] });
  },

  submitCourse() {
    if (this.data.submitting) return;
    const form = this.data.courseForm;
    if (!String(form.name || '').trim() || !String(form.code || '').trim()) {
      wx.showToast({ title: '请填写课程名称和编码', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    api.addCourse({
      name: String(form.name).trim(),
      code: String(form.code).trim(),
      term: String(form.term || '').trim()
    }).then(() => {
      this.setData({ submitting: false, showCourse: false });
      wx.showToast({ title: '课程已创建', icon: 'success' });
      return this.load(true);
    }).catch((err) => {
      this.setData({ submitting: false });
      wx.showModal({ title: '创建失败', content: err.message || '请稍后重试', showCancel: false });
    });
  },

  submitClass() {
    if (this.data.submitting) return;
    const teacher = this.data.teachers[this.data.teacherIndex];
    const form = this.data.classForm;
    if (!String(form.name || '').trim()) {
      wx.showToast({ title: '请填写教学班名称', icon: 'none' });
      return;
    }
    if (!teacher) {
      wx.showToast({ title: '请选择任课教师', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    api.addClass({
      name: String(form.name).trim(),
      teacherId: teacher.id,
      major: String(form.major || '').trim(),
      term: String(form.term || '').trim()
    }).then(() => {
      this.setData({ submitting: false, showClass: false });
      wx.showToast({ title: '教学班已创建', icon: 'success' });
      return this.load(true);
    }).catch((err) => {
      this.setData({ submitting: false });
      wx.showModal({ title: '创建失败', content: err.message || '请稍后重试', showCancel: false });
    });
  },

  submitTeacher() {
    if (this.data.submitting) return;
    const form = this.data.teacherForm;
    if (!String(form.no || '').trim() || !String(form.name || '').trim()) {
      wx.showToast({ title: '请填写工号和姓名', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    api.addTeacher({
      no: String(form.no).trim(),
      name: String(form.name).trim(),
      phone: String(form.phone || '').trim(),
      classes: ''
    }).then(() => {
      this.setData({ submitting: false, showTeacher: false });
      wx.showToast({ title: '教师已添加', icon: 'success' });
      return this.load(true);
    }).catch((err) => {
      this.setData({ submitting: false });
      wx.showModal({ title: '添加失败', content: err.message || '请检查工号是否已存在', showCancel: false });
    });
  },

  submitStudent() {
    if (this.data.submitting) return;
    const cls = this.data.classes[this.data.studentClassIndex];
    const form = this.data.studentForm;
    if (!String(form.no || '').trim() || !String(form.name || '').trim()) {
      wx.showToast({ title: '请填写学号和姓名', icon: 'none' });
      return;
    }
    if (!cls) {
      wx.showToast({ title: '请选择教学班', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    api.addStudent({
      no: String(form.no).trim(),
      name: String(form.name).trim(),
      classId: cls.id,
      major: String(form.major || '').trim(),
      adminClass: String(form.adminClass || '').trim() || cls.name
    }).then(() => {
      this.setData({ submitting: false, showStudent: false });
      wx.showToast({ title: '学员已添加', icon: 'success' });
      return this.load(true);
    }).catch((err) => {
      this.setData({ submitting: false });
      wx.showModal({ title: '添加失败', content: err.message || '请检查学号是否已存在', showCancel: false });
    });
  },

  removeCourse(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该课程';
    this.confirmDelete('删除课程', '删除「' + name + '」会级联清理课程下的教师、教学班、学员、题库、评测和作答，且无法恢复。确定继续吗？', () => api.deleteCourse(id));
  },

  removeClass(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该教学班';
    this.confirmDelete('删除教学班', '删除「' + name + '」会同时清理班内学员、评测与作答记录。确定继续吗？', () => api.deleteClass(id));
  },

  removeTeacher(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该教师';
    this.confirmDelete('删除教师', '删除「' + name + '」会级联删除其教学班、学员、评测和作答记录。确定继续吗？', () => api.deleteTeacher(id));
  },

  removeStudent(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该学员';
    this.confirmDelete('删除学员', '删除「' + name + '」会同时清理其作答记录。确定继续吗？', () => api.deleteStudent(id));
  },

  resetTeacher(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该教师';
    wx.showModal({
      title: '重置密码',
      content: '将「' + name + '」的登录密码重置为 123456？',
      success: (res) => {
        if (!res.confirm) return;
        api.resetTeacherPassword(id).then(() => {
          wx.showToast({ title: '密码已重置', icon: 'success' });
        }).catch((err) => {
          wx.showModal({ title: '操作失败', content: err.message || '请稍后重试', showCancel: false });
        });
      }
    });
  },

  confirmDelete(title, content, action) {
    wx.showModal({
      title: title,
      content: content,
      confirmText: '删除',
      confirmColor: '#b33a32',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '正在清理', mask: true });
        action().then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          return this.load(true);
        }).catch((err) => {
          wx.hideLoading();
          wx.showModal({ title: '删除失败', content: err.message || '请稍后重试', showCancel: false });
        });
      }
    });
  },

  goPage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.reLaunch({ url: url });
  },

  reload() {
    this.load(true);
  }
});
