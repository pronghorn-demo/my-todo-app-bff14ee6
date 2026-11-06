import React, { useEffect, useMemo, useRef, useState } from 'react';

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

type PersistedState = {
  version: 1;
  todos: Todo[];
};

const STORAGE_KEY = 'pronghorn_todos_v1';

function safeParseTodos(raw: string | null): Todo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const todos = Array.isArray(parsed.todos) ? parsed.todos : [];
    // Light validation
    return todos
      .filter((t) => t && typeof t === 'object')
      .map((t: any) => ({
        id: String(t.id ?? crypto.randomUUID()),
        text: String(t.text ?? ''),
        done: Boolean(t.done),
        createdAt: Number(t.createdAt ?? Date.now())
      }))
      .filter((t) => t.text.trim().length > 0);
  } catch {
    return [];
  }
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newText, setNewText] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Drag-and-drop
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setTodos(safeParseTodos(localStorage.getItem(STORAGE_KEY)));
  }, []);

  useEffect(() => {
    const state: PersistedState = { version: 1, todos };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // If storage is full/blocked, we still keep in-memory state.
    }
  }, [todos]);

  const counts = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((t) => t.done).length;
    const remaining = total - done;
    return { total, done, remaining };
  }, [todos]);

  function addTodo() {
    const text = newText.trim();
    if (!text) return;
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now()
    };
    setTodos((prev) => [todo, ...prev]);
    setNewText('');
  }

  function toggleTodo(id: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function startEdit(id: string) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setEditingText(t.text);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText('');
  }

  function commitEdit() {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      // Reject empty edits
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === editingId ? { ...t, text } : t)));
    setEditingId(null);
    setEditingText('');
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) cancelEdit();
  }

  function clearAll() {
    setTodos([]);
    setConfirmClearAll(false);
    cancelEdit();
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;

    const fromIndex = todos.findIndex((t) => t.id === draggingId);
    const toIndex = todos.findIndex((t) => t.id === overId);
    if (fromIndex < 0 || toIndex < 0) return;

    setTodos((prev) => reorder(prev, fromIndex, toIndex));
  }

  function handleDrop() {
    setDraggingId(null);
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTodo();
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>ToDoApp</h1>
        <div className="meta">
          <span>{counts.remaining} remaining</span>
          <span>{counts.done} done</span>
        </div>
      </header>

      <section className="card">
        <div className="addRow">
          <input
            aria-label="New todo"
            placeholder="Add a task..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={handleAddKeyDown}
          />
          <button onClick={addTodo} disabled={!newText.trim()}>
            Add
          </button>
        </div>

        <div className="actions">
          <button
            className="danger"
            onClick={() => setConfirmClearAll(true)}
            disabled={todos.length === 0}
          >
            Clear all
          </button>
        </div>

        {confirmClearAll && (
          <div className="confirm" role="dialog" aria-modal="true">
            <div className="confirmBox">
              <p>Clear all todos? This cannot be undone.</p>
              <div className="confirmBtns">
                <button onClick={() => setConfirmClearAll(false)}>Cancel</button>
                <button className="danger" onClick={clearAll}>
                  Yes, clear
                </button>
              </div>
            </div>
          </div>
        )}

        <ul className="list" aria-label="Todo list">
          {todos.length === 0 ? (
            <li className="empty">No todos yet. Add one above.</li>
          ) : (
            todos.map((t, index) => {
              const isEditing = editingId === t.id;
              return (
                <li
                  key={t.id}
                  className={`item ${t.done ? 'done' : ''} ${draggingId === t.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(t.id)}
                  onDragOver={(e) => handleDragOver(e, t.id)}
                  onDrop={handleDrop}
                >
                  <div className="left">
                    <button
                      className={`check ${t.done ? 'checked' : ''}`}
                      aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                      onClick={() => toggleTodo(t.id)}
                    >
                      {t.done ? '✓' : ''}
                    </button>

                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        className="editInput"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={() => {
                          // On blur: if text is empty, reject (keep editing)
                          // else commit.
                          const trimmed = editingText.trim();
                          if (!trimmed) {
                            editInputRef.current?.focus();
                            return;
                          }
                          commitEdit();
                        }}
                        aria-label="Edit todo"
                      />
                    ) : (
                      <div className="text" onDoubleClick={() => startEdit(t.id)} title="Double-click to edit">
                        <span className="index">{index + 1}.</span>
                        <span className="label">{t.text}</span>
                      </div>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="right">
                      <button onClick={() => startEdit(t.id)} className="iconBtn" aria-label="Edit">
                        ✎
                      </button>
                      <button
                        onClick={() => deleteTodo(t.id)}
                        className="iconBtn danger"
                        aria-label="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  ) : (
                    <div className="right">
                      <button
                        onClick={commitEdit}
                        disabled={!editingText.trim()}
                        className="iconBtn"
                        aria-label="Save"
                      >
                        Save
                      </button>
                      <button onClick={cancelEdit} className="iconBtn" aria-label="Cancel">
                        Cancel
                      </button>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <footer className="footer">
          <small>
            Tip: drag items to reorder. Double-click a todo text to edit.
          </small>
        </footer>
      </section>
    </div>
  );
}
