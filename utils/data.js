function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function parseTime(value) {
  if (!value) return 0;
  const t = Date.parse(value);
  return isNaN(t) ? 0 : t;
}

function serverNow(boot) {
  const offset = boot && typeof boot._serverOffset === 'number' ? boot._serverOffset : 0;
  return Date.now() + offset;
}

function formatDate(value, withTime) {
  const t = parseTime(value);
  if (!t) return '—';
  const d = new Date(t);
  const date = (d.getMonth() + 1) + '-' + pad2(d.getDate());
  if (!withTime) return date;
  return date + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function formatFullDate(value) {
  const t = parseTime(value);
  if (!t) return '—';
  const d = new Date(t);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function formatRange(paper) {
  if (!paper) return '—';
  const start = paper.startAt ? formatDate(paper.startAt, true) : '';
  const end = paper.endAt ? formatDate(paper.endAt, true) : '';
  if (start && end) return start + ' 至 ' + end;
  if (start) return start + ' 起';
  if (end) return '截止 ' + end;
  return '长期开放';
}

function formatClock(seconds) {
  let sec = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? pad2(h) + ':' : '') + pad2(m) + ':' + pad2(s);
}

function pct(score, total) {
  const s = Number(score) || 0;
  const t = Number(total) || 0;
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round(s / t * 100)));
}

function avgPct(attempts) {
  const list = (attempts || []).filter(function (a) {
    return a && a.status === 'submitted' && Number(a.total) > 0;
  });
  if (!list.length) return 0;
  const total = list.reduce(function (sum, a) { return sum + pct(a.score, a.total); }, 0);
  return Math.round(total / list.length);
}

function paperTotal(paper) {
  if (!paper || !paper.items) return 0;
  return paper.items.reduce(function (sum, item) {
    return sum + (Number(item.score) || 0);
  }, 0);
}

function findById(list, id) {
  const arr = list || [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] && arr[i].id === id) return arr[i];
  }
  return null;
}

function findQuestion(boot, id) {
  return findById(boot && boot.questions, id);
}

function findPaper(boot, id) {
  return findById(boot && boot.papers, id);
}

function findClass(boot, id) {
  return findById(boot && boot.classes, id);
}

function findStudent(boot, id) {
  return findById(boot && boot.students, id);
}

function findAttempt(boot, id) {
  return findById(boot && boot.attempts, id);
}

function paperQuestions(paper, boot) {
  if (!paper) return [];
  const qmap = {};
  (boot && boot.questions ? boot.questions : []).forEach(function (q) {
    qmap[q.id] = q;
  });
  return (paper.items || []).map(function (item) {
    const q = qmap[item.qid];
    if (!q) return null;
    const copy = Object.assign({}, q);
    copy.qid = item.qid;
    copy.score = Number(item.score) || 0;
    return copy;
  }).filter(function (q) { return !!q; });
}

function paperStatus(paper, nowMs) {
  if (!paper) return { key: 'unknown', label: '未知', tone: 'gray' };
  if (paper.status === 'draft') return { key: 'draft', label: '草稿', tone: 'gray' };
  if (paper.status === 'archived') return { key: 'archived', label: '已归档', tone: 'gray' };
  const now = nowMs || Date.now();
  const start = parseTime(paper.startAt);
  const end = parseTime(paper.endAt);
  if (start && now < start) return { key: 'upcoming', label: '未开始', tone: 'blue' };
  if (end && now > end) return { key: 'ended', label: '已结束', tone: 'gray' };
  return { key: 'ongoing', label: '进行中', tone: 'green' };
}

function attemptOf(boot, paperId, studentId) {
  const list = (boot && boot.attempts) || [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.paperId === paperId && a.studentId === studentId) return a;
  }
  return null;
}

function studentAttempts(boot, studentId) {
  return ((boot && boot.attempts) || []).filter(function (a) {
    return a.studentId === studentId;
  });
}

function myPapers(boot) {
  const user = boot && boot.user;
  if (!user) return [];
  return ((boot.papers) || []).filter(function (p) {
    if (!p || p.status === 'draft') return false;
    if (p.ownerStudentId) return p.ownerStudentId === user.id;
    return (p.classIds || []).indexOf(user.classId) >= 0;
  });
}

function teacherPapers(boot, classId) {
  return ((boot && boot.papers) || []).filter(function (p) {
    if (!p || p.ownerStudentId) return false;
    if (!classId) return true;
    return (p.classIds || []).indexOf(classId) >= 0;
  });
}

function teacherStudents(boot, classId) {
  return ((boot && boot.students) || []).filter(function (s) {
    return !classId || s.classId === classId;
  });
}

function paperTargetStudents(boot, paper) {
  if (!paper) return [];
  if (paper.ownerStudentId) {
    const student = findStudent(boot, paper.ownerStudentId);
    return student ? [student] : [];
  }
  const classIds = paper.classIds || [];
  if (!classIds.length) return [];
  return ((boot && boot.students) || []).filter(function (s) {
    return classIds.indexOf(s.classId) >= 0;
  });
}

function paperStats(boot, paper) {
  const students = paperTargetStudents(boot, paper);
  const studentIds = {};
  students.forEach(function (s) { studentIds[s.id] = true; });
  const attempts = ((boot && boot.attempts) || []).filter(function (a) {
    return a.paperId === paper.id && studentIds[a.studentId];
  });
  const submitted = attempts.filter(function (a) { return a.status === 'submitted'; });
  const inProgress = attempts.filter(function (a) { return a.status === 'in_progress'; });
  const doneStudents = {};
  submitted.forEach(function (a) { doneStudents[a.studentId] = true; });
  const inProgressStudents = {};
  inProgress.forEach(function (a) { inProgressStudents[a.studentId] = true; });
  const doneCount = Object.keys(doneStudents).length;
  const inProgressCount = Object.keys(inProgressStudents).length;
  const scores = submitted.map(function (a) { return pct(a.score, a.total); });
  return {
    expected: students.length,
    submitted: submitted.length,
    inProgress: inProgressCount,
    notStarted: Math.max(0, students.length - doneCount - inProgressCount),
    avg: scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0,
    max: scores.length ? Math.max.apply(null, scores) : 0,
    min: scores.length ? Math.min.apply(null, scores) : 0,
    completion: students.length ? Math.round(doneCount / students.length * 100) : 0
  };
}

function classStats(boot, classId) {
  const students = teacherStudents(boot, classId);
  const papers = teacherPapers(boot, classId);
  const paperIds = {};
  papers.forEach(function (p) { paperIds[p.id] = true; });
  const studentIds = {};
  students.forEach(function (s) { studentIds[s.id] = true; });
  const attempts = ((boot && boot.attempts) || []).filter(function (a) {
    return paperIds[a.paperId] && studentIds[a.studentId];
  });
  const submitted = attempts.filter(function (a) { return a.status === 'submitted'; });
  const doneStudents = {};
  submitted.forEach(function (a) { doneStudents[a.studentId] = true; });
  const doneCount = Object.keys(doneStudents).length;
  const avg = avgPct(submitted);
  return {
    studentCount: students.length,
    paperCount: papers.length,
    submittedCount: submitted.length,
    doneStudents: doneCount,
    pendingStudents: Math.max(0, students.length - doneCount),
    participation: students.length ? Math.round(doneCount / students.length * 100) : 0,
    avg: avg
  };
}

function kpMastery(boot, classId, limit) {
  const students = teacherStudents(boot, classId);
  const studentIds = {};
  students.forEach(function (s) { studentIds[s.id] = true; });
  const papers = {};
  teacherPapers(boot, classId).forEach(function (p) { papers[p.id] = p; });
  const questions = {};
  ((boot && boot.questions) || []).forEach(function (q) { questions[q.id] = q; });
  const kps = {};
  ((boot && boot.kps) || []).forEach(function (k) { kps[k.id] = k; });
  const acc = {};

  ((boot && boot.attempts) || []).forEach(function (a) {
    if (a.status !== 'submitted' || !studentIds[a.studentId]) return;
    const paper = papers[a.paperId];
    if (!paper) return;
    (paper.items || []).forEach(function (item) {
      const q = questions[item.qid];
      if (!q || !q.kpId) return;
      if (!acc[q.kpId]) acc[q.kpId] = { kpId: q.kpId, total: 0, correct: 0 };
      acc[q.kpId].total += 1;
      if (a.correct && a.correct[item.qid]) acc[q.kpId].correct += 1;
    });
  });

  const result = Object.keys(acc).map(function (id) {
    const item = acc[id];
    const kp = kps[id] || { name: id, code: '' };
    const rate = item.total ? Math.round(item.correct / item.total * 100) : 0;
    return {
      kpId: id,
      name: kp.name,
      code: kp.code,
      total: item.total,
      correct: item.correct,
      rate: rate,
      tone: rate < 60 ? 'red' : (rate < 80 ? 'amber' : 'green'),
      color: rate < 60 ? '#e5484d' : (rate < 80 ? '#f59e0b' : '#0f9f6e'),
      barWidth: Math.max(rate, 5)
    };
  }).filter(function (x) { return x.total > 0; });

  result.sort(function (a, b) { return a.rate - b.rate; });
  return limit ? result.slice(0, limit) : result;
}

function kpStatsForAttempt(boot, paper, attempt) {
  const map = {};
  const kps = {};
  ((boot && boot.kps) || []).forEach(function (k) { kps[k.id] = k; });
  paperQuestions(paper, boot).forEach(function (q) {
    if (!q.kpId) return;
    if (!map[q.kpId]) {
      const kp = kps[q.kpId] || { name: q.kpId };
      map[q.kpId] = { kpId: q.kpId, name: kp.name, total: 0, correct: 0, score: 0, totalScore: 0 };
    }
    const row = map[q.kpId];
    row.total += 1;
    row.totalScore += q.score;
    if (attempt && attempt.correct && attempt.correct[q.qid]) {
      row.correct += 1;
      row.score += q.score;
    }
  });
  return Object.keys(map).map(function (id) {
    const row = map[id];
    row.rate = row.total ? Math.round(row.correct / row.total * 100) : 0;
    row.barWidth = Math.max(row.rate, 5);
    row.tone = row.rate < 60 ? 'red' : (row.rate < 80 ? 'amber' : 'green');
    row.color = row.rate < 60 ? '#e5484d' : (row.rate < 80 ? '#f59e0b' : '#0f9f6e');
    return row;
  }).sort(function (a, b) { return a.rate - b.rate; });
}

function optionViews(question, myAnswer, correctAnswer, showCorrect) {
  const mine = String(myAnswer || '').toUpperCase();
  const right = String(correctAnswer || '').toUpperCase();
  return (question.options || []).map(function (opt) {
    const selected = mine.indexOf(opt.key) >= 0;
    const isCorrect = showCorrect && right.indexOf(opt.key) >= 0;
    let state = '';
    if (isCorrect) state = 'correct';
    else if (selected) state = showCorrect ? 'wrong' : 'selected';
    return {
      key: opt.key,
      text: opt.text,
      selected: selected,
      correct: isCorrect,
      state: state
    };
  });
}

function answerText(question, answer) {
  if (!answer) return '未作答';
  const keys = String(answer).toUpperCase();
  const parts = (question.options || []).filter(function (opt) {
    return keys.indexOf(opt.key) >= 0;
  }).map(function (opt) {
    return opt.key + '. ' + opt.text;
  });
  return parts.length ? parts.join('；') : String(answer);
}

function gradeLabel(rate) {
  if (rate >= 90) return '优秀';
  if (rate >= 80) return '良好';
  if (rate >= 60) return '及格';
  return '待提升';
}

function classNamesForPaper(boot, paper) {
  if (!paper) return '';
  if (paper.ownerStudentId) return '仅本人可见';
  const names = (paper.classIds || []).map(function (id) {
    const c = findClass(boot, id);
    return c ? c.name : '';
  }).filter(function (x) { return !!x; });
  return names.length ? names.join('、') : (paper.className || '未指定班级');
}

function reportRows(boot, paper) {
  const students = paperTargetStudents(boot, paper);
  const attempts = {};
  ((boot && boot.attempts) || []).forEach(function (a) {
    if (a.paperId === paper.id) attempts[a.studentId] = a;
  });
  const rows = students.map(function (s) {
    const a = attempts[s.id] || null;
    const submitted = a && a.status === 'submitted';
    const rate = submitted ? pct(a.score, a.total) : 0;
    return {
      student: s,
      attempt: a,
      status: submitted ? 'submitted' : (a ? 'in_progress' : 'not_started'),
      statusLabel: submitted ? '已交卷' : (a ? '作答中' : '未开始'),
      statusTone: submitted ? 'green' : (a ? 'blue' : 'gray'),
      score: submitted ? a.score : null,
      total: submitted ? a.total : paperTotal(paper),
      rate: rate,
      timeUsed: a ? a.timeUsed : 0,
      submittedAt: a ? a.submittedAt : null,
      submittedText: a && a.submittedAt ? formatDate(a.submittedAt, true) : '—'
    };
  });
  rows.sort(function (a, b) {
    const rank = { submitted: 0, in_progress: 1, not_started: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === 'submitted' && b.status === 'submitted') return b.rate - a.rate;
    return String(a.student.no || '').localeCompare(String(b.student.no || ''));
  });
  return rows;
}

function shuffle(list) {
  const arr = (list || []).slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function uniq(list) {
  const seen = {};
  const out = [];
  (list || []).forEach(function (x) {
    if (!seen[x]) {
      seen[x] = true;
      out.push(x);
    }
  });
  return out;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

module.exports = {
  pad2: pad2,
  parseTime: parseTime,
  serverNow: serverNow,
  formatDate: formatDate,
  formatFullDate: formatFullDate,
  formatRange: formatRange,
  formatClock: formatClock,
  pct: pct,
  avgPct: avgPct,
  paperTotal: paperTotal,
  findQuestion: findQuestion,
  findPaper: findPaper,
  findClass: findClass,
  findStudent: findStudent,
  findAttempt: findAttempt,
  paperQuestions: paperQuestions,
  paperStatus: paperStatus,
  attemptOf: attemptOf,
  studentAttempts: studentAttempts,
  myPapers: myPapers,
  teacherPapers: teacherPapers,
  teacherStudents: teacherStudents,
  paperTargetStudents: paperTargetStudents,
  paperStats: paperStats,
  classStats: classStats,
  kpMastery: kpMastery,
  kpStatsForAttempt: kpStatsForAttempt,
  optionViews: optionViews,
  answerText: answerText,
  gradeLabel: gradeLabel,
  classNamesForPaper: classNamesForPaper,
  reportRows: reportRows,
  shuffle: shuffle,
  uniq: uniq,
  clamp: clamp
};
