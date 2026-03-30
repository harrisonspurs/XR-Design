
const prompt = document.createElement("div");
prompt.style.cssText = `
  position: fixed;
  top: 40%;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-family: sans-serif;
  font-size: 16px;
  background: rgba(0,0,0,0.6);
  padding: 10px 20px;
  border-radius: 20px;
  pointer-events: none;
  display: none;
`;
document.body.appendChild(prompt);

let activePrompts = {};
let shownPromptId = null;
let shownPromptMessage = "";

export function registerPrompt(id, message, priority = 0) {
  activePrompts[id] = { message, priority };
  updatePrompt();
}

export function clearPrompt(id) {
  delete activePrompts[id];
  updatePrompt();
}
export function getActiveInteraction() {
  const keys = Object.keys(activePrompts);
  if (keys.length === 0) return null;
  return keys.reduce((a, b) =>
    activePrompts[a].priority >= activePrompts[b].priority ? a : b
  );
}

function updatePrompt() {
  const keys = Object.keys(activePrompts);

  if (keys.length === 0) {
    shownPromptId = null;
    shownPromptMessage = "";
    prompt.style.display = "none";
    return;
  }

  const top = keys.reduce((a, b) =>
    activePrompts[a].priority >= activePrompts[b].priority ? a : b
  );

  const nextMessage = activePrompts[top].message;
  if (shownPromptId === top && shownPromptMessage === nextMessage && prompt.style.display === "block") {
    return;
  }

  shownPromptId = top;
  shownPromptMessage = nextMessage;
  prompt.innerText = nextMessage;
  prompt.style.display = "block";
}