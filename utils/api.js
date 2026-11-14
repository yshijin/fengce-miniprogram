const config = require('../config');

const TOKEN_KEY = 'zx_token';
const USER_KEY = 'zx_user';
const TEACHER_CLASS_KEY = 'zx_teacher_class';
let redirecting = false;

function getAppSafe() {
  try {
    return getApp();
  } catch (e) {
    return null;
  }
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setSession(token, user) {
  wx.setStorageSync(TOKEN_KEY, token);
  wx.setStorageSync(USER_KEY, user);
  const app = getAppSafe();
  if (app) app.globalData.user = user;
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  const app = getAppSafe();
  if (app) {
    app.globalData.user = null;
    app.globalData.boot = null;
    app.globalData.bootAt = 0;
  }
}

function getCurrentClassId() {
  return wx.getStorageSync(TEACHER_CLASS_KEY) || '';
}

function setCurrentClassId(id) {
  if (id) wx.setStorageSync(TEACHER_CLASS_KEY, id);
}

function handleUnauthorized() {
  clearSession();
  if (redirecting) return;
  redirecting = true;
  wx.reLaunch({
    url: '/pages/login/login?expired=1',
    complete() {
      setTimeout(function () { redirecting = false; }, 900);
    }
  });
}

function errorMessage(res) {
  if (res && res.data) {
    if (typeof res.data === 'string') return res.data;
    if (res.data.message) return res.data.message;
    if (res.data.error) return res.data.error;
  }
  return '请求失败（' + (res ? res.statusCode : '网络错误') + '）';
}

function request(path, options) {
  options = options || {};
  const method = options.method || 'GET';
  const auth = options.auth !== false;
  const token = getToken();
  return new Promise(function (resolve, reject) {
    const header = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (auth && token) header.Authorization = 'Bearer ' + token;
    wx.request({
      url: config.baseUrl + path,
      method: method,
      data: options.data,
      header: header,
      timeout: 25000,
      success(res) {
        if (res.statusCode === 401 && auth) {
          handleUnauthorized();
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        const err = new Error(errorMessage(res));
        err.statusCode = res.statusCode;
        err.data = res.data;
        reject(err);
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '网络连接失败，请检查后端是否已启动'));
      }
    });
  });
}

function applyClock(payload) {
  const app = getAppSafe();
  if (!app) return;
  const time = payload && payload.serverNow ? Date.parse(payload.serverNow) : NaN;
  if (!isNaN(time)) app.globalData.serverOffset = time - Date.now();
}

function login(username, password) {
  return request('/api/auth/token', {
    method: 'POST',
    auth: false,
    data: { username: username, password: password }
  }).then(function (res) {
    const app = getAppSafe();
    if (app) {
      app.globalData.boot = null;
      app.globalData.bootAt = 0;
    }
    setSession(res.token, res.user);
    wx.removeStorageSync(TEACHER_CLASS_KEY);
    return res;
  });
}

function logout() {
  return request('/api/auth/token/logout', { method: 'POST', data: {} })
    .catch(function () { return { ok: true }; })
    .then(function (res) {
      clearSession();
      return res;
    });
}

function loadBootstrap(force) {
  const app = getAppSafe();
  if (!force && app && app.globalData.boot) {
    return Promise.resolve(app.globalData.boot);
  }
  return request('/api/bootstrap').then(function (boot) {
    const serverTime = boot && boot.serverTime ? Date.parse(boot.serverTime) : NaN;
    boot._serverOffset = isNaN(serverTime) ? 0 : serverTime - Date.now();
    if (app) {
      app.globalData.boot = boot;
      app.globalData.bootAt = Date.now();
      app.globalData.serverOffset = boot._serverOffset;
    }
    return boot;
  });
}

function startAttempt(paperId) {
  return request('/api/attempts/start', {
    method: 'POST',
    data: { paperId: paperId }
  }).then(function (res) {
    applyClock(res);
    return res;
  });
}

function saveAnswers(attemptId, answers) {
  return request('/api/attempts/' + encodeURIComponent(attemptId) + '/answers', {
    method: 'PUT',
    data: { answers: answers || {} }
  }).then(function (res) {
    applyClock(res);
    return res;
  });
}

function submitAttempt(attemptId, answers) {
  return request('/api/attempts/' + encodeURIComponent(attemptId) + '/submit', {
    method: 'POST',
    data: { answers: answers || {} }
  }).then(function (res) {
    applyClock(res);
    return res;
  });
}

function createWrongTest(qids, name, duration) {
  const payload = { qids: qids || [] };
  if (name) payload.name = name;
  if (duration) payload.duration = duration;
  return request('/api/wrongbook/tests', {
    method: 'POST',
    data: payload
  });
}

function createPaper(payload) {
  return request('/api/papers', { method: 'POST', data: payload });
}

function endPaper(id) {
  return request('/api/papers/' + encodeURIComponent(id) + '/end', {
    method: 'POST',
    data: {}
  });
}

function deletePaper(id) {
  return request('/api/papers/' + encodeURIComponent(id), { method: 'DELETE' });
}

function addStudent(payload) {
  return request('/api/students', { method: 'POST', data: payload });
}

function homeFor(role) {
  if (role === 'teacher') return '/pages/teacher/home/home';
  if (role === 'course_leader') return '/pages/cl/home/home';
  return '/pages/student/home/home';
}

function roleName(role) {
  if (role === 'teacher') return '教师';
  if (role === 'course_leader') return '课程负责人';
  return '学生';
}

module.exports = {
  config: config,
  getToken: getToken,
  getUser: getUser,
  setSession: setSession,
  clearSession: clearSession,
  getCurrentClassId: getCurrentClassId,
  setCurrentClassId: setCurrentClassId,
  request: request,
  login: login,
  logout: logout,
  loadBootstrap: loadBootstrap,
  startAttempt: startAttempt,
  saveAnswers: saveAnswers,
  submitAttempt: submitAttempt,
  createWrongTest: createWrongTest,
  createPaper: createPaper,
  endPaper: endPaper,
  deletePaper: deletePaper,
  addStudent: addStudent,
  homeFor: homeFor,
  roleName: roleName
};
