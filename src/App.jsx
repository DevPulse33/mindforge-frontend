import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Cropper from 'react-easy-crop'; 

const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 250; canvas.height = 250;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
};

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [profile, setProfile] = useState({ username: 'Гість', level: 1, xp: 0, avatar_url: '', role: 'user' });
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [reviewModalTaskId, setReviewModalTaskId] = useState(null);
  const [reflectionText, setReflectionText] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const URL = "https://mindforge-api-x4yg.onrender.com";

  useEffect(() => {
    function handleClickOutside(event) { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => setIsDropdownOpen(false), [location]);

  useEffect(() => { if (token) fetchDashboardData(); }, [token]);

  const fetchDashboardData = async () => {
    try {
      const profileRes = await fetch(`${URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (profileRes.ok) setProfile(await profileRes.json());
      const tasksRes = await fetch(`${URL}/tasks`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (tasksRes.ok) setTasks(await tasksRes.json());
    } catch (error) { console.error(error); }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    try {
      const res = await fetch(`${URL}/tasks/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ description: newTaskText })
      });
      if (res.ok) { setNewTaskText(''); fetchDashboardData(); }
    } catch (error) { console.error(error); }
  };

  const handleSubmitForReview = async (e) => {
    e.preventDefault();
    if (reflectionText.length < 10) return alert('Напишіть хоча б короткий висновок!');
    try {
      const res = await fetch(`${URL}/tasks/${reviewModalTaskId}/submit-for-review`, { 
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reflection_text: reflectionText, proof_url: proofUrl })
      });
      if (res.ok) { setReviewModalTaskId(null); setReflectionText(''); setProofUrl(''); fetchDashboardData(); }
    } catch (error) { console.error(error); }
  };

  const handleUndoTask = async (taskId) => {
    try {
      const res = await fetch(`${URL}/tasks/${taskId}/undo`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) fetchDashboardData();
    } catch (error) { console.error(error); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim(); 
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) return setMessage('❌ Введіть коректну email адресу');
    if (password.length < 6) return setMessage('❌ Пароль має містити від 6 символів');
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    try {
      const response = await fetch(`${URL}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cleanEmail, password }),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(`❌ Помилка: ${data.message || 'Щось пішло не так'}`);

      if (isLogin) {
        localStorage.setItem('token', data.token); setToken(data.token); setMessage(''); navigate('/');
      } else {
        setMessage('⏳ Реєстрація успішна! Входимо...');
        const loginResponse = await fetch(`${URL}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cleanEmail, password }),
        });
        const loginData = await loginResponse.json();
        localStorage.setItem('token', loginData.token); setToken(loginData.token); setMessage(''); navigate('/');
      }
    } catch (error) { setMessage('❌ Помилка з\'єднання з сервером.'); }
  };

  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); setMessage(''); setIsLogin(true); setEmail(''); setPassword(''); setIsDropdownOpen(false); navigate('/login'); };

  const UserAvatar = ({ sizeClasses = "w-10 h-10 text-sm", profileData = profile }) => (
    profileData.avatar_url ? ( <img src={profileData.avatar_url} alt="avatar" className={`${sizeClasses} rounded-full object-cover border-2 border-indigo-200`} /> ) : ( <div className={`${sizeClasses} rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center`}> {profileData.username.charAt(0).toUpperCase()} </div> )
  );

  const SettingsPage = () => {
    const [tab, setTab] = useState('profile');
    const [newUsername, setNewUsername] = useState(profile.username);
    const [statusMsg, setStatusMsg] = useState('');
    const [imageSrc, setImageSrc] = useState(null); 
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [finalAvatarBase64, setFinalAvatarBase64] = useState(profile.avatar_url || '');

    const onFileChange = async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => { setImageSrc(reader.result); };
      }
    };
    const handleCropComplete = async () => {
      try { const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels); setFinalAvatarBase64(croppedImage); setImageSrc(null); } catch (e) { console.error(e); }
    };
    const saveProfile = async (e) => {
      e.preventDefault();
      const res = await fetch(`${URL}/profile/update`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ username: newUsername, avatar_url: finalAvatarBase64 }) });
      if (res.ok) { setStatusMsg('✅ Профіль успішно оновлено!'); fetchDashboardData(); } else setStatusMsg('❌ Помилка оновлення');
      setTimeout(() => setStatusMsg(''), 3000);
    };

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const changePassword = async (e) => {
      e.preventDefault();
      if (newPassword.length < 6) return setStatusMsg('❌ Новий пароль має бути від 6 символів');
      if (oldPassword === newPassword) return setStatusMsg('❌ Новий пароль не може бути таким самим, як старий');
      const res = await fetch(`${URL}/auth/change-password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ oldPassword, newPassword }) });
      const data = await res.json();
      setStatusMsg(res.ok ? '✅ Пароль успішно змінено!' : `❌ ${data.message}`);
      if(res.ok) { setOldPassword(''); setNewPassword(''); }
      setTimeout(() => setStatusMsg(''), 3000);
    };

    return (
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in relative">
        <div className="flex border-b border-slate-200">
          <button onClick={() => setTab('profile')} className={`flex-1 py-4 font-semibold ${tab === 'profile' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>Профіль</button>
          <button onClick={() => setTab('security')} className={`flex-1 py-4 font-semibold ${tab === 'security' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>Безпека</button>
        </div>
        <div className="p-4 sm:p-8">
          {statusMsg && <div className={`p-3 mb-6 rounded-lg text-sm font-medium text-center ${statusMsg.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{statusMsg}</div>}
          {tab === 'profile' && (
            <form onSubmit={saveProfile} className="space-y-6">
              <div className="flex flex-col items-center mb-8">
                <div className="mb-4">
                  {finalAvatarBase64 ? <img src={finalAvatarBase64} alt="Preview" className="w-32 h-32 rounded-full object-cover border-4 border-indigo-100 shadow-sm" /> : <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border-4 border-dashed border-slate-200">Немає фото</div>}
                </div>
                <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-100 transition border border-indigo-200 text-center w-full sm:w-auto">
                  Завантажити нове фото <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                </label>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Відображуване ім'я</label><input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
              <button type="submit" className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition">Зберегти всі зміни</button>
            </form>
          )}
          {tab === 'security' && (
            <form onSubmit={changePassword} className="space-y-6">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Старий пароль</label><input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Новий пароль</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
              <button type="submit" className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-900">Змінити пароль</button>
            </form>
          )}
          {imageSrc && (
            <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
              <div className="bg-white p-4 rounded-2xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-4 text-center">Кадрування фото</h3>
                <div className="relative w-full h-64 bg-slate-900 rounded-lg overflow-hidden mb-4"><Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" onCropChange={setCrop} onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)} onZoomChange={setZoom} /></div>
                <div className="mb-4"><label className="text-sm font-medium text-slate-600">Масштаб</label><input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} className="w-full mt-2" /></div>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <button onClick={() => setImageSrc(null)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-300">Скасувати</button>
                  <button onClick={handleCropComplete} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">Застосувати</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AdminPage = () => {
    const [adminTab, setAdminTab] = useState('tasks');
    const [adminTasks, setAdminTasks] = useState([]);
    
    const [testTitle, setTestTitle] = useState('');
    const [testDesc, setTestDesc] = useState('');
    const [testXP, setTestXP] = useState(50);
    const [testQuestions, setTestQuestions] = useState([{ text: '', options: ['', ''], correctAnswerIndex: 0 }]);
    const [testStatus, setTestStatus] = useState('');

    useEffect(() => { fetchAdminTasks(); }, []);
    
    const fetchAdminTasks = async () => {
      try {
        const res = await fetch(`${URL}/tasks/admin/review-list`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setAdminTasks(await res.json());
      } catch (e) { console.error(e); }
    };
    
    const handleAction = async (taskId, action) => {
      try { await fetch(`${URL}/tasks/admin/${taskId}/${action}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); fetchAdminTasks(); } catch (e) { console.error(e); }
    };

    const addQuestion = () => setTestQuestions([...testQuestions, { text: '', options: ['', ''], correctAnswerIndex: 0 }]);
    const removeQuestion = (qIndex) => { if (testQuestions.length > 1) { const newQ = [...testQuestions]; newQ.splice(qIndex, 1); setTestQuestions(newQ); } };
    const updateQuestionText = (text, qIndex) => { const newQ = [...testQuestions]; newQ[qIndex].text = text; setTestQuestions(newQ); };
    const updateOption = (text, qIndex, optIndex) => { const newQ = [...testQuestions]; newQ[qIndex].options[optIndex] = text; setTestQuestions(newQ); };
    const addOption = (qIndex) => { const newQ = [...testQuestions]; newQ[qIndex].options.push(''); setTestQuestions(newQ); };
    const setCorrectAnswer = (qIndex, optIndex) => { const newQ = [...testQuestions]; newQ[qIndex].correctAnswerIndex = optIndex; setTestQuestions(newQ); };

    const handleSaveTest = async (e) => {
      e.preventDefault();
      for (let q of testQuestions) {
        if (!q.text.trim()) return setTestStatus('❌ Заповніть всі питання');
        for (let opt of q.options) { if (!opt.trim()) return setTestStatus('❌ Заповніть всі варіанти відповідей'); }
      }
      try {
        const res = await fetch(`${URL}/tests/admin/add`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ title: testTitle, description: testDesc, xpReward: testXP, questions: testQuestions })
        });
        if (res.ok) {
          setTestStatus('✅ Тест успішно створено!');
          setTestTitle(''); setTestDesc(''); setTestXP(50); setTestQuestions([{ text: '', options: ['', ''], correctAnswerIndex: 0 }]);
        } else setTestStatus('❌ Помилка збереження');
      } catch (err) { setTestStatus('❌ Помилка з\'єднання'); }
      setTimeout(() => setTestStatus(''), 3000);
    };

    if (profile.role !== 'admin') return <div className="text-center mt-20 text-red-500 text-2xl font-bold">Доступ заборонено</div>;

    return (
      <div className="max-w-4xl mx-auto animate-fade-in bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 flex-col sm:flex-row">
          <button onClick={() => setAdminTab('tasks')} className={`flex-1 py-4 font-bold text-lg ${adminTab === 'tasks' ? 'text-red-600 border-b-2 border-red-600 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>Перевірка завдань</button>
          <button onClick={() => setAdminTab('tests')} className={`flex-1 py-4 font-bold text-lg ${adminTab === 'tests' ? 'text-red-600 border-b-2 border-red-600 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>Створити Тест</button>
        </div>
        <div className="p-4 sm:p-8">
          {adminTab === 'tasks' && (
            <>
              {adminTasks.length === 0 ? ( <div className="p-10 text-center text-slate-500 text-lg">Немає завдань для перевірки 🎉</div> ) : (
                <div className="space-y-4">
                  {adminTasks.map(task => (
                    <div key={task.id} className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4 border-b pb-4">
                        {task.avatar_url ? <img src={task.avatar_url} alt="av" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-600">{task.username.charAt(0)}</div>}
                        <div><h3 className="font-bold text-slate-800">{task.username}</h3><p className="text-sm text-indigo-600 font-medium break-words">Завдання: {task.description}</p></div>
                      </div>
                      <div className="bg-white p-4 rounded-xl mb-4 border border-slate-200 overflow-hidden">
                        <p className="text-sm text-slate-500 mb-1">Рефлексія / Висновок:</p>
                        <p className="text-slate-800 font-medium whitespace-pre-wrap break-words">{task.reflection_text}</p>
                        {task.proof_url && (<div className="mt-3"><p className="text-sm text-slate-500 mb-1">Посилання (Доказ):</p><a href={task.proof_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm break-all">{task.proof_url}</a></div>)}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={() => handleAction(task.id, 'approve')} className="flex-1 bg-green-500 text-white font-bold py-3 sm:py-2 rounded-lg hover:bg-green-600 transition">Схвалити (+20 XP)</button>
                        <button onClick={() => handleAction(task.id, 'reject')} className="flex-1 bg-red-100 text-red-600 font-bold py-3 sm:py-2 rounded-lg hover:bg-red-200 transition">Відхилити</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {adminTab === 'tests' && (
            <form onSubmit={handleSaveTest} className="space-y-8">
              {testStatus && <div className={`p-4 rounded-lg font-bold text-center ${testStatus.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{testStatus}</div>}
              <div className="bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200 space-y-4">
                <h2 className="font-bold text-xl text-slate-800">Основна інформація</h2>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Назва тесту</label><input type="text" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Опис</label><textarea value={testDesc} onChange={(e) => setTestDesc(e.target.value)} required rows="2" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Нагорода (XP)</label><input type="number" min="10" step="10" value={testXP} onChange={(e) => setTestXP(e.target.value)} required className="w-full sm:w-32 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="space-y-6">
                <h2 className="font-bold text-xl text-slate-800">Питання</h2>
                {testQuestions.map((q, qIndex) => (
                  <div key={qIndex} className="bg-white p-4 sm:p-6 rounded-xl border-2 border-slate-200 relative">
                    {testQuestions.length > 1 && <button type="button" onClick={() => removeQuestion(qIndex)} className="absolute top-2 right-2 sm:top-4 sm:right-4 text-red-500 hover:text-red-700 font-bold text-xs sm:text-sm bg-red-50 px-2 py-1 rounded">Видалити</button>}
                    <div className="mb-4 mt-6 sm:mt-0">
                      <label className="block font-bold text-slate-700 mb-1">Питання {qIndex + 1}</label>
                      <input type="text" value={q.text} onChange={(e) => updateQuestionText(e.target.value, qIndex)} required className="w-full px-4 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-indigo-50" />
                    </div>
                    <div className="space-y-2 sm:ml-4">
                      <label className="block text-sm font-medium text-slate-500">Варіанти відповідей (виберіть правильний):</label>
                      {q.options.map((opt, optIndex) => (
                        <div key={optIndex} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-2">
                             <input type="radio" name={`correct-${qIndex}`} checked={q.correctAnswerIndex === optIndex} onChange={() => setCorrectAnswer(qIndex, optIndex)} className="w-5 h-5 text-indigo-600 shrink-0" />
                             <span className="sm:hidden text-sm font-medium">Правильна</span>
                          </div>
                          <input type="text" value={opt} onChange={(e) => updateOption(e.target.value, qIndex, optIndex)} required className="w-full px-3 py-2 sm:py-1 border rounded focus:ring-2 focus:ring-indigo-500" placeholder={`Варіант ${optIndex + 1}`} />
                        </div>
                      ))}
                      <button type="button" onClick={() => addOption(qIndex)} className="text-sm font-bold text-indigo-600 mt-2 hover:underline">+ Додати варіант</button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addQuestion} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition">+ Додати наступне питання</button>
              <button type="submit" className="w-full bg-slate-900 text-white text-lg py-4 rounded-xl font-bold hover:bg-black transition shadow-lg">💾 Зберегти та Опублікувати тест</button>
            </form>
          )}
        </div>
      </div>
    );
  };

  const TestsPage = () => {
    const [tests, setTests] = useState([]);
    const [currentTest, setCurrentTest] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [result, setResult] = useState(null);

    useEffect(() => {
      fetch(`${URL}/tests`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setTests(data))
        .catch(err => console.error(err));
    }, []);

    const startTest = (test) => { setCurrentTest(test); setCurrentQuestionIndex(0); setSelectedAnswers({}); setResult(null); };
    const handleAnswer = (index) => { setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: index })); };
    const handleNext = () => { if (currentQuestionIndex < currentTest.questions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); } else { finishTest(); } };

    const finishTest = async () => {
      let score = 0;
      currentTest.questions.forEach((q, index) => { if (selectedAnswers[index] === q.correctAnswerIndex) score++; });
      const isPassed = score >= Math.ceil(currentTest.questions.length / 2);
      try {
        const res = await fetch(`${URL}/tests/${currentTest.id}/complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ score, maxScore: currentTest.questions.length })
        });
        const data = await res.json();
        setResult({ score, max: currentTest.questions.length, success: isPassed, xpGained: isPassed ? currentTest.xp_reward : 0 });
        if (data.success) fetchDashboardData(); 
      } catch (err) { console.error(err); }
    };

    if (result) {
      return (
        <div className="max-w-2xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 text-center animate-fade-in">
          <div className="text-5xl sm:text-6xl mb-4">{result.success ? '🎉' : '❌'}</div>
          <h2 className={`text-2xl sm:text-3xl font-bold mb-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? 'Тест пройдено успішно!' : 'Тест не пройдено'}
          </h2>
          <p className="text-base sm:text-lg text-slate-500 mb-8">Ваш результат: <span className="font-bold text-slate-800">{result.score} з {result.max}</span> правильних відповідей.</p>
          {result.success ? (
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl mb-8">
              <p className="text-slate-600 font-medium mb-2">Нагорода за знання:</p><p className="text-3xl font-bold text-indigo-600">+{result.xpGained} XP</p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-100 p-6 rounded-xl mb-8"><p className="text-red-700 font-medium">Ви зробили забагато помилок. Повторіть матеріал і спробуйте свої сили ще раз.</p></div>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!result.success && <button onClick={() => startTest(currentTest)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition">Спробувати ще раз</button>}
            <button onClick={() => setCurrentTest(null)} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition">До списку тестів</button>
          </div>
        </div>
      );
    }

    if (currentTest) {
      const q = currentTest.questions[currentQuestionIndex];
      return (
        <div className="max-w-3xl mx-auto bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">{currentTest.title}</h2>
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs sm:text-sm font-bold w-max">Питання {currentQuestionIndex + 1} / {currentTest.questions.length}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-8"><div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${((currentQuestionIndex) / currentTest.questions.length) * 100}%` }}></div></div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6">{q.text}</h3>
          <div className="space-y-3 mb-8">
            {q.options.map((option, index) => (
              <div key={index} onClick={() => handleAnswer(index)} className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedAnswers[currentQuestionIndex] === index ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${selectedAnswers[currentQuestionIndex] === index ? 'border-indigo-600' : 'border-slate-300'}`}>{selectedAnswers[currentQuestionIndex] === index && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}</div>
                  <span className={`font-medium break-words ${selectedAnswers[currentQuestionIndex] === index ? 'text-indigo-800' : 'text-slate-700'}`}>{option}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end"><button onClick={handleNext} disabled={selectedAnswers[currentQuestionIndex] === undefined} className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold transition ${selectedAnswers[currentQuestionIndex] !== undefined ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{currentQuestionIndex === currentTest.questions.length - 1 ? 'Завершити тест' : 'Наступне питання'}</button></div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">Перевірка навичок</h1>
        <p className="text-sm sm:text-base text-slate-500 mb-8">Проходьте тести, щоб перевірити свої знання та отримати додатковий досвід (XP).</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tests.map(test => (
            <div key={test.id} className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-4 gap-2">
                   <h3 className="text-lg sm:text-xl font-bold text-slate-800">{test.title}</h3>
                   <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-lg w-max">+{test.xp_reward} XP</span>
                </div>
                <p className="text-sm sm:text-base text-slate-500 mb-6">{test.description}</p>
              </div>
              <button onClick={() => startTest(test)} className="w-full bg-indigo-50 text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-100 transition">Почати тестування</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const LeaderboardPage = () => {
    const [leaders, setLeaders] = useState([]);

    useEffect(() => {
      fetch(`${URL}/profile/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setLeaders(data))
        .catch(err => console.error(err));
    }, []);

    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-4">Таблиця лідерів 🏆</h1>
          <p className="text-slate-500 text-lg">Топ-10 найактивніших дослідників нашої платформи.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {leaders.map((user, index) => {
            let bgClass = "bg-white hover:bg-slate-50";
            let rankBadge = <span className="text-slate-400 font-bold text-lg w-8 text-center">{index + 1}</span>;
            
            if (index === 0) {
              bgClass = "bg-yellow-50 border-b-2 border-yellow-200";
              rankBadge = <span className="text-yellow-600 text-2xl" title="1 місце">🥇</span>;
            } else if (index === 1) {
              bgClass = "bg-slate-100 border-b-2 border-slate-200";
              rankBadge = <span className="text-slate-500 text-2xl" title="2 місце">🥈</span>;
            } else if (index === 2) {
              bgClass = "bg-orange-50 border-b-2 border-orange-200";
              rankBadge = <span className="text-orange-600 text-2xl" title="3 місце">🥉</span>;
            }

            const isMe = user.username === profile.username;

            return (
              <div key={index} className={`flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 transition ${bgClass}`}>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="w-8 flex justify-center">{rankBadge}</div>
                  <UserAvatar sizeClasses="w-12 h-12 sm:w-16 sm:h-16 text-lg sm:text-xl" profileData={user} />
                  <div>
                    <h3 className={`font-bold text-base sm:text-xl ${isMe ? 'text-indigo-600' : 'text-slate-800'}`}>
                      {user.username} {isMe && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded ml-2 align-middle">Це ви</span>}
                    </h3>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-indigo-100 text-indigo-700 font-extrabold px-3 sm:px-4 py-1 sm:py-2 rounded-xl text-sm sm:text-base">
                    LVL {user.level}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">{user.xp} XP</div>
                </div>
              </div>
            );
          })}
          {leaders.length === 0 && <div className="p-10 text-center text-slate-500">Завантаження рейтингу...</div>}
        </div>
      </div>
    );
  };

  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/login" />} />
        <Route path="/login" element={
          <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md">
              <div className="text-center mb-8"><h1 className="text-3xl font-bold text-indigo-600 mb-2">MindForge</h1><p className="text-slate-500">Платформа розвитку навичок</p></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
                <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg">{isLogin ? 'Увійти' : 'Створити акаунт'}</button>
              </form>
              <p className="text-center mt-6 text-sm text-slate-600">{isLogin ? 'Ще немає акаунта? ' : 'Вже маєте акаунт? '}<button type="button" onClick={() => { setIsLogin(!isLogin); }} className="text-indigo-600 font-semibold hover:underline">{isLogin ? 'Зареєструватись' : 'Увійти'}</button></p>
            </div>
          </div>
        } />
      </Routes>
    );
  }

  const toggleDropdown = (e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); };

  // ==========================================
  // СТОРІНКА ПРОФІЛЮ (ОНОВЛЕНА: З БЕЙДЖАМИ)
  // ==========================================
  const ProfilePage = () => {
    const [myRank, setMyRank] = useState(null);

    useEffect(() => {
      fetch(`${URL}/profile/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const index = data.findIndex(user => user.username === profile.username);
          if (index !== -1) {
            setMyRank(index + 1); 
          } else {
            setMyRank('> 10'); 
          }
        })
        .catch(err => console.error(err));
    }, []);

    // Логіка для Бейджів (Досягнень)
    const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
    const hasCustomName = profile.username !== 'Гість' && !profile.username.startsWith('Student_');
    const hasAvatar = profile.avatar_url && profile.avatar_url.trim() !== '';
    const rankNum = typeof myRank === 'number' ? myRank : 999; // 999 - якщо не в топі
    
    const badges = [
      // --- СТАРТОВІ ---
      { id: 1, name: "Ідентифікація", desc: "Змінити ім'я", icon: "✍️", unlocked: hasCustomName },
      { id: 2, name: "Нове обличчя", desc: "Встановити аватарку", icon: "🖼️", unlocked: hasAvatar },
      { id: 3, name: "Перший крок", desc: "Виконано 1 завдання", icon: "🎯", unlocked: completedTasksCount >= 1 },
      
      // --- ПРОДУКТИВНІСТЬ ---
      { id: 4, name: "Ефективність", desc: "Виконано 5 завдань", icon: "⚡", unlocked: completedTasksCount >= 5 },
      { id: 5, name: "Продуктивність", desc: "Виконано 10 завдань", icon: "🚀", unlocked: completedTasksCount >= 10 },
      { id: 6, name: "Майстер часу", desc: "Виконано 25 завдань", icon: "⏳", unlocked: completedTasksCount >= 25 },
      { id: 7, name: "Бібліотека", desc: "Виконано 50 завдань", icon: "📚", unlocked: completedTasksCount >= 50 },

      // --- РІВНІ ---
      { id: 8, name: "Дослідник", desc: "Досягнуто 2 рівня", icon: "🔍", unlocked: profile.level >= 2 },
      { id: 9, name: "Ерудит", desc: "Досягнуто 5 рівня", icon: "🧠", unlocked: profile.level >= 5 },
      { id: 10, name: "Магістр", desc: "Досягнуто 10 рівня", icon: "🎓", unlocked: profile.level >= 10 },
      { id: 11, name: "Грандмайстер", desc: "Досягнуто 20 рівня", icon: "🧙‍♂️", unlocked: profile.level >= 20 },

      // --- РЕЙТИНГ ---
      { id: 12, name: "Альпініст", desc: "Увійти в Топ-10", icon: "🧗‍♂️", unlocked: rankNum <= 10 },
      { id: 13, name: "Бронзовий розум", desc: "Топ-3 рейтингу", icon: "🥉", unlocked: rankNum <= 3 },
      { id: 14, name: "Срібний інтелект", desc: "Топ-2 рейтингу", icon: "🥈", unlocked: rankNum <= 2 },
      { id: 15, name: "Абсолютний лідер", desc: "Топ-1 рейтингу", icon: "🥇", unlocked: rankNum === 1 },
      
      // --- ТАЄМНЕ ---
      { id: 16, name: "Творець Матриці", desc: "Права адміністратора", icon: "👑", unlocked: profile.role === 'admin' },
    ];

    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto text-center animate-fade-in">
        <div className="flex justify-center mb-4"><UserAvatar sizeClasses="w-45 h-45 text-4xl sm:text-5xl" /></div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{profile.username}</h1>
        <p className="text-sm sm:text-base text-slate-500 mb-8">Учень епохи суспільства знань</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Поточний рівень</p>
            <p className="text-2xl font-bold text-indigo-600">{profile.level}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Виконано завдань</p>
            <p className="text-2xl font-bold text-indigo-600">{completedTasksCount}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
            <p className="text-sm text-yellow-700 mb-1">Місце в рейтингу</p>
            <p className="text-2xl font-bold text-yellow-600">
              {myRank ? `#${myRank}` : '...'}
            </p>
          </div>
        </div>

        {/* НОВИЙ БЛОК: ДОСЯГНЕННЯ */}
        <div className="mt-10 text-left">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Мої досягнення 🏅</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
             {badges.map(badge => (
                <div key={badge.id} className={`p-4 rounded-xl border text-center transition-all duration-300 ${badge.unlocked ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                   <div className="text-3xl mb-2">{badge.icon}</div>
                   <h3 className={`font-bold text-sm leading-tight mb-1 ${badge.unlocked ? 'text-indigo-700' : 'text-slate-500'}`}>{badge.name}</h3>
                   <p className="text-xs text-slate-400">{badge.description}</p>
                </div>
             ))}
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-100">
           <Link to="/leaderboard" className="text-indigo-600 font-bold hover:underline">Переглянути повну таблицю лідерів 🏆</Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-x-hidden">
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-2xl font-bold text-indigo-600 tracking-tight">MindForge</Link>
              <div className="hidden md:flex gap-6">
                <Link to="/" className={`font-medium transition ${location.pathname === '/' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>Головна</Link>
                <Link to="/dashboard" className={`font-medium transition ${location.pathname === '/dashboard' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>Дашборд</Link>
                <Link to="/tests" className={`font-medium transition ${location.pathname === '/tests' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>Тести 🧠</Link>
                <Link to="/leaderboard" className={`font-medium transition ${location.pathname === '/leaderboard' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>Рейтинг 🏆</Link>
                {profile.role === 'admin' && <Link to="/admin" className={`font-bold transition ${location.pathname === '/admin' ? 'text-red-600' : 'text-red-400 hover:text-red-600'}`}>Адмін-панель</Link>}
              </div>
            </div>
            <div className="relative" ref={dropdownRef}>
              <button onClick={toggleDropdown} className="focus:outline-none transition transform hover:scale-105 active:scale-95 cursor-pointer touch-manipulation">
                <UserAvatar sizeClasses="w-10 h-10 text-sm" />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-10">
                  <div className="md:hidden border-b border-slate-100 mb-1 pb-1">
                    <Link to="/" className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium">Головна</Link>
                    <Link to="/dashboard" className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium">Дашборд</Link>
                    <Link to="/tests" className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium">Тести 🧠</Link>
                    <Link to="/leaderboard" className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium">Рейтинг 🏆</Link>
                    {profile.role === 'admin' && <Link to="/admin" className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-bold">Адмін-панель</Link>}
                  </div>
                  <Link to="/profile" className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">👤 Мій Профіль</Link>
                  <Link to="/settings" className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">⚙️ Налаштування</Link>
                  <div className="h-px bg-slate-200 my-1"></div>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium">🚪 Вийти з акаунта</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={
            <div className="space-y-12 sm:space-y-16 animate-fade-in pb-8 sm:pb-12">
              <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-6 sm:p-10 md:p-16 text-white text-center shadow-2xl overflow-hidden">
                <div className="relative z-10">
                  <span className="inline-block py-1 px-3 rounded-full bg-white/20 text-indigo-100 text-xs sm:text-sm font-bold tracking-wider mb-4 sm:mb-6 backdrop-blur-sm border border-white/30">ВЕРСІЯ 1.0 (MVP)</span>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 leading-tight break-words hyphens-auto">Твій персональний навігатор у <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">Суспільстві Знань</span></h1>
                  <p className="text-base sm:text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto mb-8 sm:mb-10">Перетвори саморозвиток на захопливу гру. Оцінюй свої навички, виконуй реальні завдання, отримуй XP та ставай кращою версією себе.</p>
                  <button onClick={() => navigate('/dashboard')} className="w-full sm:w-auto bg-white text-indigo-700 font-extrabold text-base sm:text-lg px-8 sm:px-10 py-4 rounded-full hover:bg-indigo-50 shadow-[0_0_20px_rgba(255,255,255,0.3)] transform hover:-translate-y-1 transition-all">Почати свій шлях 🚀</button>
                </div>
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                  <div className="absolute -top-20 -left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                  <div className="absolute top-40 -right-20 w-80 h-80 bg-purple-400 rounded-full blur-3xl"></div>
                </div>
              </div>

              <div className="max-w-4xl mx-auto text-center px-2 sm:px-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">Чому це важливо саме зараз?</h2>
                <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 sm:p-8 rounded-r-2xl text-left shadow-sm">
                  <p className="text-lg sm:text-xl italic text-slate-700 mb-4 break-words">«У XXI столітті неписьменними будуть не ті, хто не вміє читати і писати, а ті, хто не вміє вчитися, відучуватися і переучуватися.»</p>
                  <p className="font-bold text-indigo-600 text-sm sm:text-base">— Елвін Тоффлер (соціолог та футуролог)</p>
                </div>
              </div>

              <div>
                <div className="text-center mb-8 sm:mb-10"><h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3 sm:mb-4">Для кого створена платформа?</h2><p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto">MindForge об'єднує тих, хто не хоче стояти на місці. Знайди себе серед них:</p></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                  <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl mb-4 sm:mb-6">🎓</div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2 sm:mb-3">Студенти та Школярі</h3><p className="text-sm sm:text-base text-slate-500">Вийди за рамки шкільної програми. Визнач свої слабкі місця та побудуй план для успішного старту кар'єри.</p>
                  </div>
                  <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl mb-4 sm:mb-6">💻</div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2 sm:mb-3">Початківці в ІТ</h3><p className="text-sm sm:text-base text-slate-500">Трекай вивчення нових технологій. Комбінуй Hard Skills (код) та Soft Skills (комунікація), щоб стати Senior.</p>
                  </div>
                  <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl mb-4 sm:mb-6">🚀</div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2 sm:mb-3">Life-long Learners</h3><p className="text-sm sm:text-base text-slate-500">Для тих, хто постійно шукає нові знання. Захисти себе від інформаційного шуму та структуруй свій розвиток.</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 md:p-16 text-white shadow-xl">
                <div className="text-center mb-10 sm:mb-12"><h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Як досягти успіху з MindForge?</h2><p className="text-sm sm:text-base text-slate-400">Простий алгоритм перетворення інформації на реальні навички.</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-6">
                  <div className="text-center"><div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mx-auto mb-4 border-2 border-indigo-500 text-indigo-400">1</div><h4 className="font-bold mb-2">Оціни себе</h4><p className="text-xs sm:text-sm text-slate-400">Проходь інтерактивні тести на цифрову грамотність та мислення.</p></div>
                  <div className="text-center"><div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mx-auto mb-4 border-2 border-indigo-500 text-indigo-400">2</div><h4 className="font-bold mb-2">Склади план</h4><p className="text-xs sm:text-sm text-slate-400">Додавай конкретні завдання (Roadmap) у свій персональний Дашборд.</p></div>
                  <div className="text-center"><div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mx-auto mb-4 border-2 border-indigo-500 text-indigo-400">3</div><h4 className="font-bold mb-2">Роби висновки</h4><p className="text-xs sm:text-sm text-slate-400">Виконав завдання? Напиши коротку рефлексію, щоб закріпити матеріал.</p></div>
                  <div className="text-center"><div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mx-auto mb-4 border-2 border-indigo-500 text-indigo-400">4</div><h4 className="font-bold mb-2">Качай рівень</h4><p className="text-xs sm:text-sm text-slate-400">Отримуй XP за кожну дію. Підвищуй свій реальний рівень як у RPG грі.</p></div>
                </div>
              </div>
            </div>
          } />
          
          <Route path="/dashboard" element={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
                  <div className="flex justify-center mb-4"><UserAvatar sizeClasses="w-24 h-24 sm:w-32 sm:h-32 text-2xl sm:text-4xl" /></div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">{profile.username}</h2>
                  <div className="flex items-center justify-between mb-2 mt-6"><span className="text-sm font-medium text-slate-500">Рівень</span><span className="bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-sm font-bold">LVL {profile.level}</span></div>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500 mt-4"><span>Досвід (XP)</span><span>{profile.xp} / 100</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-3"><div className="bg-indigo-500 h-3 rounded-full transition-all" style={{ width: `${profile.xp}%` }}></div></div>
                </div>
              </div>
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-xl font-bold text-slate-800 mb-4">План розвитку</h2>
                  <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 sm:gap-2 mb-6">
                    <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Додати завдання..." className="w-full sm:flex-1 px-4 py-3 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 sm:py-2 rounded-lg font-semibold hover:bg-indigo-700">Додати</button>
                  </form>
                  <ul className="space-y-3">
                    {tasks.map(task => (
                      <li key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className={`text-slate-700 break-words w-full sm:w-auto ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>{task.description}</span>
                        
                        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                          {task.status === 'pending' && <button onClick={() => setReviewModalTaskId(task.id)} className="text-sm bg-indigo-100 text-indigo-700 font-bold px-3 py-2 sm:py-1 rounded-lg hover:bg-indigo-200 transition">Виконати</button>}
                          {task.status === 'under_review' && (
                            <>
                              <span className="text-xs sm:text-sm bg-yellow-100 text-yellow-700 font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg whitespace-nowrap">На перевірці ⏳</span>
                              <button onClick={() => handleUndoTask(task.id)} className="text-xs bg-slate-200 text-slate-600 px-2 sm:px-3 py-1.5 sm:py-1 rounded hover:bg-slate-300 whitespace-nowrap">↩ Скасувати</button>
                            </>
                          )}
                          {task.status === 'completed' && (
                            <>
                              <span className="text-xs sm:text-sm text-slate-400 font-semibold whitespace-nowrap">Виконано ✓</span>
                              <button onClick={() => handleUndoTask(task.id)} className="text-xs bg-slate-200 text-slate-600 px-2 sm:px-3 py-1.5 sm:py-1 rounded hover:bg-slate-300 whitespace-nowrap">↩ Скасувати</button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          } />

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {reviewModalTaskId && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Підтвердження виконання</h3>
            <p className="text-slate-500 text-sm mb-6">Опишіть, що саме ви вивчили або зробили, щоб адміністратор міг нарахувати вам XP.</p>
            <form onSubmit={handleSubmitForReview} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Ваш висновок / Інсайт (обов'язково)</label><textarea required rows="3" value={reflectionText} onChange={(e) => setReflectionText(e.target.value)} placeholder="Я дізнався, що..." className="w-full px-4 py-3 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"></textarea></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Посилання на результат (опціонально)</label><input type="url" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://github.com/..." className="w-full px-4 py-3 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button type="button" onClick={() => setReviewModalTaskId(null)} className="w-full sm:flex-1 bg-slate-200 text-slate-700 py-3 sm:py-2 rounded-lg font-semibold hover:bg-slate-300">Скасувати</button>
                <button type="submit" className="w-full sm:flex-1 bg-indigo-600 text-white py-3 sm:py-2 rounded-lg font-semibold hover:bg-indigo-700">Відправити на перевірку</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() { return <Router><AppContent /></Router>; }