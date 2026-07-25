"use client";

import { useEffect, useRef, useState } from "react";
import { extractTextFromFile } from "./lib/extractText";

const STORAGE_KEY = "notewise_notes";

export default function Home() {
  const [notesList, setNotesList] = useState([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setNotesList(JSON.parse(saved));
      } catch {
        setNotesList([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesList));
  }, [notesList]);

  const activeNote = notesList.find((n) => n.id === activeId);

  const WORD_LIMIT = 2500;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const overLimit = wordCount > WORD_LIMIT;

  async function handleFile(file) {
    if (!file) return;
    setError("");
    setExtracting(true);
    try {
      const extracted = await extractTextFromFile(file);
      setText((prev) => (prev ? prev + "\n\n" + extracted : extracted));
      setFileName(file.name);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (e) {
      setError(e.message || "Could not read that file.");
    } finally {
      setExtracting(false);
    }
  }

  function handleSaveNote() {
    if (!title.trim() || !text.trim()) {
      setError("Please add both a title and some notes text.");
      return;
    }
    if (overLimit) {
      setError(
        `Your notes are ${wordCount.toLocaleString()} words, which is over the ${WORD_LIMIT.toLocaleString()}-word limit. Please shorten them or split into two notes.`
      );
      return;
    }
    const newNote = {
      id: Date.now().toString(),
      title: title.trim(),
      text: text.trim(),
      summary: null,
      quiz: null,
      createdAt: new Date().toISOString(),
    };
    setNotesList([newNote, ...notesList]);
    setTitle("");
    setText("");
    setFileName("");
    setActiveId(newNote.id);
    setError("");
  }

  function handleDeleteNote(id) {
    setNotesList(notesList.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function handleGenerate(id) {
    setError("");
    setLoading(true);
    setShowResults(false);
    setSelectedAnswers({});

    const note = notesList.find((n) => n.id === id);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: note.text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setNotesList((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, summary: data.summary, quiz: data.quiz } : n
        )
      );
    } catch (e) {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAnswer(qIndex, option) {
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: option }));
  }

  function scoreQuiz() {
    if (!activeNote?.quiz) return 0;
    let score = 0;
    activeNote.quiz.forEach((q, i) => {
      if (selectedAnswers[i] === q.answer) score++;
    });
    return score;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span className="brand-name">NoteWise</span>
        </div>
        <p className="tagline">Paste or upload notes. Get a summary and a quiz.</p>

        <div>
          <div className="sidebar-section-label">Your notes</div>
          <div className="notes-list">
            {notesList.length === 0 && (
              <p className="empty-sidebar">No notes saved yet.</p>
            )}
            {notesList.map((n) => (
              <div
                key={n.id}
                className={`note-tab ${activeId === n.id ? "active" : ""}`}
                onClick={() => {
                  setActiveId(n.id);
                  setShowResults(false);
                  setSelectedAnswers({});
                }}
              >
                <p className="note-tab-title">{n.title}</p>
                <p className="note-tab-preview">{n.text.slice(0, 40)}...</p>
                <button
                  className="note-tab-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(n.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main">
        <h1 className="page-title">Add a note</h1>
        <p className="page-subtitle">
          Paste your lecture notes, or drop in a .txt, .pdf, or .docx file.
        </p>

        <section className="composer">
          <label className="field-label">Title</label>
          <input
            className="input"
            placeholder="e.g. Chapter 4 - Photosynthesis"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="field-label">Notes</label>
          <textarea
            className="textarea"
            placeholder="Paste your lecture notes here..."
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className={`word-count ${overLimit ? "over" : ""}`}>
            {wordCount.toLocaleString()} / {WORD_LIMIT.toLocaleString()} words
            {overLimit && " — please shorten, or split into two notes"}
          </p>

          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <span className="dropzone-icon">📎</span>
            <span className="dropzone-text">
              <strong>Click to upload</strong> or drag a file here — .txt, .pdf, or .docx
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.docx"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {extracting && <p className="extracting">Reading file…</p>}
          {fileName && !extracting && (
            <div className="file-chip">
              📄 {fileName}
              <button onClick={() => setFileName("")}>✕</button>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div>
            <button className="btn primary" onClick={handleSaveNote}>
              Save note
            </button>
          </div>
        </section>

        {!activeNote && (
          <div className="note-detail">
            <p className="empty-state">
              Select a note from the left to view it, or save a new one above.
            </p>
          </div>
        )}

        {activeNote && (
          <div className="note-detail fade-in">
            <h2 className="note-detail-title">{activeNote.title}</h2>
            <div className="note-text">{activeNote.text}</div>

            <button
              className="btn accent"
              onClick={() => handleGenerate(activeNote.id)}
              disabled={loading || activeNote.text.trim().split(/\s+/).length > WORD_LIMIT}
            >
              {loading && <span className="spinner"></span>}
              {loading ? "Generating…" : "✨ Generate summary & quiz"}
            </button>
            {activeNote.text.trim().split(/\s+/).length > WORD_LIMIT && (
              <p className="error-text">
                This note is too long ({activeNote.text.trim().split(/\s+/).length.toLocaleString()} words) for the AI to process at once. Delete it and re-save as two shorter notes.
              </p>
            )}

            {activeNote.summary && activeNote.summary.length > 0 && (
              <div className="summary-box">
                <h3 className="section-heading">🖍️ Summary</h3>
                <ul className="summary-list">
                  {activeNote.summary.map((point, i) => (
                    <li key={i}>
                      <span className="mark">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeNote.quiz && activeNote.quiz.length > 0 && (
              <div className="quiz-box">
                <h3 className="section-heading">📝 Practice quiz</h3>
                {activeNote.quiz.map((q, qi) => (
                  <div key={qi} className="quiz-question">
                    <p className="q-text">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="options">
                      {q.options.map((opt, oi) => {
                        const isSelected = selectedAnswers[qi] === opt;
                        const isCorrect = showResults && opt === q.answer;
                        const isWrongSelected =
                          showResults && isSelected && opt !== q.answer;
                        return (
                          <button
                            key={oi}
                            className={`option ${isSelected ? "selected" : ""} ${
                              isCorrect ? "correct" : ""
                            } ${isWrongSelected ? "wrong" : ""}`}
                            onClick={() => handleSelectAnswer(qi, opt)}
                          >
                            <span className="bubble"></span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button className="btn primary" onClick={() => setShowResults(true)}>
                  Check answers
                </button>
                {showResults && (
                  <div className="score-banner">
                    <span>Your score</span>
                    <strong>
                      {scoreQuiz()} / {activeNote.quiz.length}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
