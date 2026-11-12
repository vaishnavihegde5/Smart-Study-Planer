"use strict";
const $ = id => document.getElementById(id);
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function action(text, fn, cls) {
  const button = el("button", text, cls);
  button.type = "button";
  button.onclick = fn;
  return button;
}
const tasks = read("studyTasks_v3", []);
const goals = read("studyGoals", []);
const columns = [
  ["To Do", "Inbox", "#92a18e"], ["Today", "Focus today", "#d69b46"],
  ["Upcoming", "Upcoming", "#789eaf"], ["Done", "Completed", "#669068"]
];
const rank = {High: 0, Medium: 1, Low: 2};
function sortedTasks() {
  return [...tasks].sort((a,b) => rank[a.priority] - rank[b.priority] ||
    (a.date || "9999").localeCompare(b.date || "9999"));
}
function summary() {
  const done = tasks.filter(t => t.status === "Done").length;
  $("open-count").textContent = tasks.length - done;
  $("done-count").textContent = done;
  $("goal-count").textContent = goals.filter(g => g.progress < g.target).length;
  $("completion").value = tasks.length ? Math.round(100 * done / tasks.length) : 0;
  $("progress-label").textContent = tasks.length ? done + " of " + tasks.length + " tasks finished" : "Your progress starts with your first task.";
}
const taskForm = $("task-form");
let editing;
for (const [status,title] of columns) taskForm.elements.status.add(new Option(title,status));
function openTask(task, status = "To Do") {
  editing = task;
  taskForm.reset();
  $("task-title").textContent = task ? "Edit task" : "New task";
  for (const [key,value] of Object.entries(task || {status})) {
    if (taskForm.elements[key]) taskForm.elements[key].value = value;
  }
  $("task-dialog").showModal();
  taskForm.elements.text.focus();
}
function updateTasks() {
  save("studyTasks_v3", tasks);
  $("advice").hidden = true;
  renderBoard();
}
taskForm.onsubmit = event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(taskForm));
  data.text = data.text.trim();
  if (!data.text) return taskForm.elements.text.focus();
  if (editing) Object.assign(editing, data);
  else tasks.push({...data, id:crypto.randomUUID()});
  $("task-dialog").close();
  updateTasks();
};
$("new-task").onclick = () => openTask();
document.querySelectorAll(".cancel").forEach(btn => btn.onclick = () => btn.closest("dialog").close());
function renderBoard() {
  $("columns").replaceChildren();
  const sorted = sortedTasks();
  for (const [status,title,color] of columns) {
    const group = sorted.filter(t => t.status === status);
    const col = el("div", undefined, "column");
    col.style.setProperty("--dot",color);
    const heading = el("h3",title);
    heading.append(el("span",group.length));
    col.append(heading);
    if (!group.length) col.append(el("p","No tasks here yet.","empty"));
    for (const task of group) {
      const item = el("article",undefined,"task");
      item.draggable = true;
      item.ondragstart = e => e.dataTransfer.setData("text/plain",String(task.id));
      const due = task.date ? " · " + new Date(task.date + "T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}) : "";
      item.append(el("strong",task.text),el("small",task.priority + " priority" + due));
      const controls = el("div", undefined, "actions");
      controls.append(action("Edit",() => openTask(task)),action(status === "Done" ? "Reopen" : "Complete",() => {
        task.status = status === "Done" ? "To Do" : "Done";
        updateTasks();
      }),action("Delete",() => {
        if (!confirm("Delete this task?")) return;
        tasks.splice(tasks.indexOf(task),1);
        updateTasks();
      }));
      item.append(controls);
      col.append(item);
    }
    col.append(action("＋ Add task",() => openTask(null,status),"add"));
    col.ondragover = e => { e.preventDefault(); col.classList.add("over"); };
    col.ondragleave = () => col.classList.remove("over");
    col.ondrop = e => {
      e.preventDefault();
      col.classList.remove("over");
      const task = tasks.find(t => String(t.id) === e.dataTransfer.getData("text/plain"));
      if (task) { task.status = status; updateTasks(); }
    };
    $("columns").append(col);
  }
  summary();
}
$("new-goal").onclick = () => $("goal-dialog").showModal();
$("goal-form").onsubmit = e => {
  e.preventDefault();
  const form = e.currentTarget;
  const {text,target,unit} = Object.fromEntries(new FormData(form));
  if (!text.trim()) return form.elements.text.focus();
  goals.push({id:crypto.randomUUID(),text:text.trim(),target:Number(target),progress:0,unit});
  form.reset();
  $("goal-dialog").close();
  updateGoals();
};
function updateGoals() { save("studyGoals",goals); renderGoals(); }
function renderGoals() {
  const list = $("goal-list");
  list.replaceChildren();
  if (!goals.length) list.append(el("p","Set a goal in pages, hours, problems or sessions to track your progress.","empty-wrap"));
  for (const goal of goals) {
    const card = el("article", undefined, "goal");
    const done = Math.min(goal.progress,goal.target);
    const bar = el("progress");
    bar.max = goal.target;
    bar.value = done;
    bar.setAttribute("aria-label",goal.text);
    card.append(el("h3",goal.text),el("p",done + " / " + goal.target + " " + (goal.unit || "units") + (done === goal.target ? " · Complete" : "")),bar);
    const form = el("form",undefined,"actions");
    if (done < goal.target) {
      const amount = el("input");
      Object.assign(amount,{type:"number",min:1,step:1,value:1,required:true});
      amount.setAttribute("aria-label","Progress to add");
      form.append(amount,el("button","Log progress"));
      form.onsubmit = e => {
        e.preventDefault();
        goal.progress = Math.min(goal.target,done + amount.valueAsNumber);
        updateGoals();
      };
    }
    form.append(action("Delete",() => {
      if (confirm("Delete this goal?")) { goals.splice(goals.indexOf(goal),1); updateGoals(); }
    }));
    card.append(form);
    list.append(card);
  }
  summary();
}
function notebook(key,listId,addId,isFlash) {
  const entries = read(key,[]);
  const list = $(listId);
  function render() {
    list.replaceChildren();
    if (!entries.length) list.append(el("p",isFlash ? "Add a question and an answer to practise recall." : "Capture a thought to revisit during your next session.","empty"));
    for (const note of entries) {
      const card = el("article",undefined,isFlash ? "note flash" : "note");
      if (isFlash) {
        const prompt = el("input");
        prompt.placeholder = "Question or concept";
        prompt.setAttribute("aria-label",prompt.placeholder);
        prompt.value = note.prompt || "";
        prompt.oninput = () => { note.prompt = prompt.value; save(key,entries); };
        card.append(prompt);
      }
      const field = el("textarea");
      field.placeholder = isFlash ? "Answer or definition" : "Write a note…";
      field.setAttribute("aria-label",field.placeholder);
      field.value = note.content;
      field.oninput = () => { note.content = field.value; save(key,entries); };
      card.append(field);
      if (isFlash) {
        field.hidden = Boolean(note.content);
        const toggle = action(field.hidden ? "Reveal answer" : "Hide answer",() => {
          field.hidden = !field.hidden;
          toggle.textContent = field.hidden ? "Reveal answer" : "Hide answer";
        });
        card.append(toggle);
      }
      card.append(action("Delete",() => {
        if (confirm("Delete this note?")) { entries.splice(entries.indexOf(note),1); save(key,entries); render(); }
      }));
      list.append(card);
    }
  }
  $(addId).onclick = () => {
    entries.push({id:crypto.randomUUID(),content:""});
    save(key,entries);
    render();
    list.lastElementChild.querySelector("input,textarea").focus();
  };
  render();
}
notebook("stickyNotes","memo-list","new-note",false);
notebook("flashNotes","flash-list","new-flash",true);
const methods = {
  "Pomodoro":"Pick one task, work for 25 minutes, then take a five-minute break.",
  "Spaced repetition":"Review a concept today, then revisit it in one day, three days and one week. Shorten the interval for difficult material.",
  "Active recall":"Close your notes and answer a flashcard from memory. Reveal the answer and revisit anything you missed.",
  "Feynman technique":"Explain the idea aloud as if teaching a beginner. Revisit the first step you cannot explain, then try again."
};
for (const name of Object.keys(methods)) $("method").add(new Option(name));
function showMethod(name) {
  $("method").value = name;
  $("method-info").textContent = methods[name];
  localStorage.setItem("studyMethod",name);
}
showMethod(localStorage.getItem("studyMethod") in methods ? localStorage.getItem("studyMethod") : "Pomodoro");
$("method").onchange = () => showMethod($("method").value);
$("prioritize").onclick = () => {
  const next = sortedTasks().find(t => t.status !== "Done");
  const method = next && /review|revise|practice/i.test(next.text) ? "Active recall" : "Pomodoro";
  $("advice").hidden = false;
  $("advice").textContent = next ? "Start with “" + next.text + "” (" + next.priority.toLowerCase() + " priority). " + methods[method] : "Your board is clear. Add a task to get a recommendation.";
  if (next) showMethod(method);
};
function tab(id) {
  for (const btn of $("tabs").children) {
    const selected = btn.dataset.panel === id;
    btn.setAttribute("aria-pressed",selected);
    $(btn.dataset.panel).hidden = !selected;
  }
}
for (const btn of $("tabs").children) btn.onclick = () => tab(btn.dataset.panel);
tab("notes");
const theme = $("theme");
function applyTheme(value) {
  theme.value = ["calm","focus","default"].includes(value) ? value : "default";
  document.body.dataset.theme = theme.value;
  localStorage.setItem("studyTheme",theme.value);
}
applyTheme(localStorage.getItem("studyTheme"));
theme.onchange = () => applyTheme(theme.value);
const now = new Date();
$("date").textContent = now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
const affirmations = ["One focused session is progress.","Give yourself time to learn.","Start with one idea you want to understand."];
let daily = read("dailyAffirmation",{});
if (daily.date !== now.toDateString()) {
  daily = {date:now.toDateString(),text:affirmations[Math.floor(Math.random()*affirmations.length)]};
  save("dailyAffirmation",daily);
}
$("affirmation").textContent = daily.text;
const quotes = ["What can you explain today that you couldn’t explain yesterday?","Which idea deserves another five minutes?","What is the smallest next step you can take?"];
let quote = now.getDate() % quotes.length;
function reflection() { $("quote").textContent = quotes[quote]; }
$("next-quote").onclick = () => { quote = (quote + 1) % quotes.length; reflection(); };
reflection();
const durations = {focus:1500,short:300,long:900};
const timer = read("studyTimer",{mode:"focus",left:1500,end:0});
function setMode(mode) {
  Object.assign(timer,{mode,left:durations[mode],end:0});
  save("studyTimer",timer);
  tick();
}
function tick() {
  if (timer.end && Date.now() >= timer.end) {
    const next = timer.mode === "focus" ? "short" : "focus";
    Object.assign(timer,{mode:next,left:durations[next],end:Date.now()+durations[next]*1000});
    save("studyTimer",timer);
  }
  const seconds = timer.end ? Math.ceil((timer.end-Date.now())/1000) : timer.left;
  const time = [Math.floor(seconds/60),seconds%60].map(n => String(n).padStart(2,"0")).join(":");
  $("clock").textContent = time;
  $("dial-label").textContent = timer.mode === "focus" ? "Focus" : "Break";
  $("start").textContent = timer.end ? "Ⅱ Pause" : timer.left === durations[timer.mode] ? "▶ Start session" : "▶ Resume";
  $("timer-status").textContent = timer.end ? "Session in progress" : timer.left === durations[timer.mode] ? "Ready when you are" : "Session paused";
  document.title = timer.end ? time + " · " + $("dial-label").textContent + " | Smart Study Planner" : "Smart Study Planner";
  for (const btn of $("modes").children) btn.setAttribute("aria-pressed",btn.dataset.mode === timer.mode);
}
for (const btn of $("modes").children) btn.onclick = () => setMode(btn.dataset.mode);
$("start").onclick = () => {
  tick();
  if (timer.end) { timer.left = Math.max(1,Math.ceil((timer.end-Date.now())/1000)); timer.end = 0; }
  else timer.end = Date.now()+timer.left*1000;
  save("studyTimer",timer);
  tick();
};
$("reset").onclick = () => setMode(timer.mode);
tick();
setInterval(tick,500);
let audio, gain, chordLoop;
$("audio").onclick = async () => {
  const button = $("audio");
  button.disabled = true;
  try {
    if (audio) {
      clearInterval(chordLoop);
      await audio.close();
      audio = null;
      button.textContent = "Play sound";
    } else {
      audio = new AudioContext();
      await audio.resume();
      gain = audio.createGain();
      gain.gain.value = Number($("volume").value);
      gain.connect(audio.destination);
      const chords = [[196,246.94,293.66],[164.81,196,246.94],[174.61,220,261.63],[146.83,185,220]];
      let index = 0;
      function playChord() {
        const start = audio.currentTime;
        for (const hz of chords[index]) {
          const osc = audio.createOscillator(), env = audio.createGain();
          osc.frequency.value = hz;
          env.gain.setValueAtTime(0,start);
          env.gain.linearRampToValueAtTime(.075,start+.7);
          env.gain.linearRampToValueAtTime(0,start+4.4);
          osc.connect(env).connect(gain);
          osc.start(); osc.stop(start+4.5);
          osc.onended = () => { osc.disconnect(); env.disconnect(); };
        }
        index = (index+1)%chords.length;
      }
      playChord();
      chordLoop = setInterval(playChord,4200);
      button.textContent = "Stop sound";
    }
    $("audio-status").textContent = "";
  } catch { $("audio-status").textContent = "Audio is unavailable in this browser."; }
  finally { button.disabled = false; }
};
$("volume").oninput = () => { if (audio && gain) gain.gain.setTargetAtTime(Number($("volume").value),audio.currentTime,.03); };
renderBoard();
renderGoals();
