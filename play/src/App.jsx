import { useState, useMemo, useEffect, Fragment } from "react";
import { QUESTIONS } from "./questions.js";
import { QUESTIONS_WEBADMIN } from "./questions-webadmin.js";
import { QUESTIONS_CSP } from "./questions-csp.js";

// ============================================================
// CONFIGURATION DES SUJETS ET DIFFICULTÉS
// ============================================================
const TOTAL = 60;

const SUBJECTS = [
    {
        id: "js",
        label: "JavaScript",
        badge: "JS",
        badgeColor: "#F7DF1E",
        badgeTextColor: "#000",
        desc: "Fondamentaux · Closures · Async · DOM · Event Loop",
        questions: QUESTIONS,
        total: 60,
        difficulties: [
            { id: "facile", label: "Facile", traps: 12, desc: "20% de questions pièges", detail: "Restitution du cours, quelques pièges.", accent: "#4ADE80" },
            { id: "normal", label: "Normal", traps: 27, desc: "45% de questions pièges", detail: "Cours + coercition, hoisting, scope, event loop.", accent: "#F7DF1E" },
            { id: "difficile", label: "Difficile", traps: 45, desc: "75% de questions pièges", detail: "Majorité de code à prédire et de cas retors.", accent: "#F87171" },
        ],
    },
    {
        id: "webadmin",
        label: "Web Administrateur",
        badge: "SRV",
        badgeColor: "#7C3AED",
        badgeTextColor: "#fff",
        desc: "Systemd · Crontab · NGINX · PHP-FPM · Docker",
        questions: QUESTIONS_WEBADMIN,
        total: 40,
        difficulties: [
            { id: "facile", label: "Facile", traps: 8, desc: "20% de questions pièges", detail: "Commandes de base, concepts fondamentaux.", accent: "#4ADE80" },
            { id: "normal", label: "Normal", traps: 14, desc: "35% de questions pièges", detail: "Pièges de configuration, erreurs classiques.", accent: "#A78BFA" },
            { id: "difficile", label: "Difficile", traps: 20, desc: "50% de questions pièges", detail: "Sécurité, escalade de privilèges, cas tordus.", accent: "#F87171" },
        ],
    },
    {
        id: "csp",
        label: "Examen civique · CSP",
        badge: "CSP",
        badgeColor: "#0055A4",
        badgeTextColor: "#fff",
        desc: "République · Institutions · Droits · Histoire · Vie quotidienne",
        questions: QUESTIONS_CSP,
        total: 28,
        difficulties: [
            { id: "facile", label: "Facile", traps: 4, desc: "Révision guidée", detail: "Les repères et notions les plus directs.", accent: "#4ADE80" },
            { id: "normal", label: "Normal", traps: 8, desc: "Examen blanc", detail: "Format de 28 questions, avec des formulations à bien lire.", accent: "#F7DF1E" },
            { id: "difficile", label: "Difficile", traps: 10, desc: "Révision approfondie", detail: "Davantage de distinctions et de questions pièges.", accent: "#F87171" },
        ],
    },
];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildQuiz(nTraps, questions, total) {
    const traps = shuffle(questions.filter((q) => q.trap)).slice(0, nTraps);
    const normals = shuffle(questions.filter((q) => !q.trap)).slice(0, total - nTraps);
    // Mélange des options pour chaque question
    const withShuffledOptions = [...traps, ...normals].map((q) => {
        const order = shuffle(q.options.map((_, i) => i));
        return {
            ...q,
            options: order.map((i) => q.options[i]),
            correct: order.indexOf(q.correct),
        };
    });
    return shuffle(withShuffledOptions);
}

function isExplEdited(subjectId, id) {
    return localStorage.getItem(`expl_${subjectId}_${id}`) !== null;
}

function shuffleQuestion(q) {
    const order = shuffle(q.options.map((_, i) => i));
    return { ...q, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correct) };
}

// Parse /:subjectId/:questionId at module load time — before any effects can clobber the URL
function parseRoute() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
        const subj = SUBJECTS.find((s) => s.id === parts[0]);
        const qId = parseInt(parts[1], 10);
        if (subj) {
            const found = subj.questions.find((q) => q.id === qId);
            if (found) return { subject: subj, question: shuffleQuestion(found) };
        }
    }
    return null;
}
const INITIAL_ROUTE = parseRoute();
const PROGRESS_KEY = "qcm_progress_v1";

function restoreQuiz(subject, savedQuiz) {
    if (!Array.isArray(savedQuiz) || savedQuiz.length === 0) return null;

    const restored = savedQuiz.map(({ id, optionOrder }) => {
        const original = subject.questions.find((q) => q.id === id);
        const validOrder = Array.isArray(optionOrder)
            && optionOrder.length === original?.options.length
            && new Set(optionOrder).size === optionOrder.length
            && optionOrder.every((index) => Number.isInteger(index) && index >= 0 && index < original.options.length);
        if (!original || !validOrder) return null;

        return {
            ...original,
            options: optionOrder.map((index) => original.options[index]),
            correct: optionOrder.indexOf(original.correct),
        };
    });

    return restored.every(Boolean) ? restored : null;
}

function loadProgress() {
    try {
        const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
        if (!saved || !["exam", "results"].includes(saved.screen)) return null;

        const subject = SUBJECTS.find((item) => item.id === saved.subjectId);
        const difficulty = saved.difficultyId === "all"
            ? { id: "all", label: "Tout" }
            : subject?.difficulties.find((item) => item.id === saved.difficultyId);
        const quiz = subject && restoreQuiz(subject, saved.quiz);
        const answersValid = Array.isArray(saved.answers)
            && saved.answers.length === quiz?.length
            && saved.answers.every((answer) => answer === null || (Number.isInteger(answer) && answer >= 0 && answer < 4));

        if (!subject || !difficulty || !quiz || !answersValid) return null;

        return {
            screen: saved.screen,
            subject,
            difficulty,
            quiz,
            answers: saved.answers,
            current: Number.isInteger(saved.current) && saved.current >= 0 && saved.current < quiz.length ? saved.current : 0,
            quizTotal: quiz.length,
            filter: ["all", "wrong", "edited"].includes(saved.filter) ? saved.filter : "all",
        };
    } catch {
        return null;
    }
}

function serializeQuiz(subject, quiz) {
    return quiz.map((q) => {
        const original = subject.questions.find((item) => item.id === q.id);
        return { id: q.id, optionOrder: q.options.map((option) => original.options.indexOf(option)) };
    });
}

const SAVED_PROGRESS = loadProgress();
const RESUMED_PROGRESS = SAVED_PROGRESS
    && (!INITIAL_ROUTE || (INITIAL_ROUTE.subject.id === SAVED_PROGRESS.subject.id
        && INITIAL_ROUTE.question.id === SAVED_PROGRESS.quiz[SAVED_PROGRESS.current].id))
    ? SAVED_PROGRESS
    : null;

// ============================================================
// STYLES
// ============================================================
const S = {
    bg: "#F5F6F8",
    panel: "#FFFFFF",
    panelSoft: "#EEF1F5",
    border: "#D8DEE6",
    yellow: "#F7DF1E",   // bright JS yellow — for filled surfaces (badges, buttons) with black text
    accent: "#8A7300",   // readable dark gold — for yellow used as text/active state on light bg
    code: "#0550AE",     // code-block text color on light background
    text: "#1A2028",
    muted: "#5B6470",
    green: "#15803D",
    red: "#DC2626",
};

const fontDisplay = "'Space Grotesk', 'Segoe UI', sans-serif";
const fontMono = "'JetBrains Mono', 'Fira Code', monospace";

export default function QcmJavascript() {
    const [screen, setScreen] = useState(RESUMED_PROGRESS?.screen ?? (INITIAL_ROUTE ? "single" : "home")); // home | subject | exam | results | single
    const [subject, setSubject] = useState(RESUMED_PROGRESS?.subject ?? INITIAL_ROUTE?.subject ?? null);
    const [quizTotal, setQuizTotal] = useState(RESUMED_PROGRESS?.quizTotal ?? TOTAL);
    const [difficulty, setDifficulty] = useState(RESUMED_PROGRESS?.difficulty ?? null);
    const [quiz, setQuiz] = useState(RESUMED_PROGRESS?.quiz ?? []);
    const [answers, setAnswers] = useState(RESUMED_PROGRESS?.answers ?? []);
    const [current, setCurrent] = useState(RESUMED_PROGRESS?.current ?? 0);
    const [filter, setFilter] = useState(RESUMED_PROGRESS?.filter ?? "all"); // all | wrong | edited
    const [singleQuestion, setSingleQuestion] = useState(INITIAL_ROUTE?.question ?? null);
    const [singleAnswer, setSingleAnswer] = useState(null);

    useEffect(() => {
        if (screen === "exam" && quiz.length > 0) {
            window.history.replaceState(null, "", `/${subject.id}/${quiz[current].id}`);
        } else if (screen !== "single") {
            window.history.replaceState(null, "", "/");
        }
    }, [screen, current, quiz, subject]);

    useEffect(() => {
        if (!["exam", "results"].includes(screen) || !subject || !difficulty || quiz.length === 0) return;

        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify({
                screen,
                subjectId: subject.id,
                difficultyId: difficulty.id,
                quiz: serializeQuiz(subject, quiz),
                answers,
                current,
                filter,
            }));
        } catch {
            // L'application reste utilisable si le stockage local est désactivé ou plein.
        }
    }, [screen, subject, difficulty, quiz, answers, current, filter]);

    const selectSubject = (subj) => {
        setSubject(subj);
        setScreen("subject");
    };

    const start = (diff) => {
        const all = diff.id === "all";
        const questions = subject.questions;
        const total = all ? questions.length : subject.total;
        const nTraps = all ? questions.filter((q) => q.trap).length : diff.traps;
        setDifficulty(diff);
        setQuizTotal(total);
        setQuiz(buildQuiz(nTraps, questions, total));
        setAnswers(Array(total).fill(null));
        setCurrent(0);
        setFilter("all");
        setScreen("exam");
    };

    const restart = () => {
        localStorage.removeItem(PROGRESS_KEY);
        setScreen("home");
        setSubject(null);
        setDifficulty(null);
        setQuiz([]);
        setAnswers([]);
        setQuizTotal(TOTAL);
    };

    const backToSubject = () => {
        localStorage.removeItem(PROGRESS_KEY);
        setScreen("subject");
    };

    const answeredCount = answers.filter((a) => a !== null).length;
    const score = useMemo(
        () => quiz.reduce((s, q, i) => s + (answers[i] === q.correct ? 1 : 0), 0),
        [quiz, answers]
    );

    const finish = () => setScreen("results");

    // ------------------------------------------------ HOME (subject selection)
    if (screen === "home") {
        return (
            <Shell>
                <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
                        {SUBJECTS.map((s) => (
                            <SubjectBadge key={s.id} subj={s} />
                        ))}
                    </div>
                    <h1 style={{ fontFamily: fontDisplay, fontSize: 40, fontWeight: 700, color: S.text, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
                        QCM for Aijing
                    </h1>
                    <p style={{ color: S.muted, fontSize: 15, margin: "0 0 6px", fontFamily: fontDisplay }}>
                        60 questions · correction immédiate  · prise de notes
                    </p>
                    <p style={{ color: S.muted, fontSize: 13, margin: "0 0 36px", fontFamily: fontMono }}>
                        Choisissez votre matière
                    </p>

                    <div style={{ display: "grid", gap: 14 }}>
                        {SUBJECTS.map((subj) => (
                            <button
                                key={subj.id}
                                onClick={() => selectSubject(subj)}
                                style={{
                                    textAlign: "left",
                                    background: S.panel,
                                    border: `1px solid ${S.border}`,
                                    borderLeft: `4px solid ${subj.badgeColor}`,
                                    borderRadius: 10,
                                    padding: "18px 22px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 18,
                                    transition: "border-color .12s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = subj.badgeColor)}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.borderLeftColor = subj.badgeColor; }}
                            >
                                <SubjectBadge subj={subj} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 19, color: S.text }}>{subj.label}</div>
                                    <div style={{ color: S.muted, fontSize: 13, marginTop: 4, fontFamily: fontDisplay }}>{subj.desc}</div>
                                </div>
                                <span style={{ fontFamily: fontMono, fontSize: 13, color: S.muted }}>→</span>
                            </button>
                        ))}
                    </div>

                    <p style={{ color: S.muted, fontSize: 12, marginTop: 28, fontFamily: fontDisplay, lineHeight: 1.6 }}>
                        Les questions et réponses sont mélangées à chaque lancement. Une « question piège » teste un comportement contre-intuitif ou une erreur classique.
                    </p>
                </div>
            </Shell>
        );
    }

    // ------------------------------------------------ SUBJECT (difficulty selection)
    if (screen === "subject") {
        return (
            <Shell>
                <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
                    <button onClick={() => setScreen("home")} style={{ ...navBtn(false), marginBottom: 28, display: "flex", alignItems: "center", gap: 6 }}>
                        ← Retour
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                        <SubjectBadge subj={subject} />
                        <h1 style={{ fontFamily: fontDisplay, fontSize: 36, fontWeight: 700, color: S.text, margin: 0, letterSpacing: "-0.02em" }}>
                            {subject.label}
                        </h1>
                    </div>
                    <p style={{ color: S.muted, fontSize: 14, margin: "0 0 36px", fontFamily: fontMono }}>
                        {subject.desc}
                    </p>

                    <div style={{ display: "grid", gap: 14 }}>
                        {subject.difficulties.map((d) => (
                            <button
                                key={d.id}
                                onClick={() => start(d)}
                                style={{
                                    textAlign: "left",
                                    background: S.panel,
                                    border: `1px solid ${S.border}`,
                                    borderLeft: `4px solid ${d.accent}`,
                                    borderRadius: 10,
                                    padding: "18px 22px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 16,
                                    transition: "border-color .12s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = d.accent)}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.borderLeftColor = d.accent; }}
                            >
                                <div>
                                    <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 19, color: S.text }}>{d.label}</div>
                                    <div style={{ color: S.muted, fontSize: 13, marginTop: 4, fontFamily: fontDisplay }}>{d.detail}</div>
                                </div>
                                <div style={{ fontFamily: fontMono, fontSize: 13, color: d.accent, whiteSpace: "nowrap" }}>{d.desc}</div>
                            </button>
                        ))}

                        <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 4 }} />

                        <button
                            onClick={() => start({ id: "all", label: "Tout" })}
                            style={{
                                textAlign: "left",
                                background: S.panel,
                                border: `1px solid ${S.border}`,
                                borderLeft: `4px solid ${S.muted}`,
                                borderRadius: 10,
                                padding: "18px 22px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                                transition: "border-color .12s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = S.muted)}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.borderLeftColor = S.muted; }}
                        >
                            <div>
                                <div style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 19, color: S.text }}>Toutes les questions</div>
                                <div style={{ color: S.muted, fontSize: 13, marginTop: 4, fontFamily: fontDisplay }}>Parcourir l'intégralité du corpus dans un ordre aléatoire.</div>
                            </div>
                            <div style={{ fontFamily: fontMono, fontSize: 13, color: S.muted, whiteSpace: "nowrap" }}>{subject.questions.length} questions</div>
                        </button>
                    </div>

                    <p style={{ color: S.muted, fontSize: 12, marginTop: 28, fontFamily: fontDisplay, lineHeight: 1.6 }}>
                        60 questions tirées aléatoirement du corpus. Une « question piège » teste un comportement contre-intuitif ou une erreur d'administration classique.
                    </p>
                </div>
            </Shell>
        );
    }

    // ------------------------------------------------ EXAM
    if (screen === "exam") {
        const q = quiz[current];
        const answered = answers[current] !== null;
        const selectedIdx = answers[current];
        const isCorrect = selectedIdx === q.correct;

        return (
            <Shell>
                <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px 48px" }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <SubjectBadge subj={subject} small />
                            <span style={{ fontFamily: fontMono, fontSize: 13, color: S.muted }}>
                {difficulty.label} · question {current + 1}/{quizTotal}
              </span>
                        </div>
                        <span style={{ fontFamily: fontMono, fontSize: 13, color: S.muted }}>
              {answeredCount}/{quizTotal} répondues
            </span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: 4, background: S.border, borderRadius: 2, marginBottom: 24 }}>
                        <div style={{ height: 4, width: `${(answeredCount / quizTotal) * 100}%`, background: S.yellow, borderRadius: 2, transition: "width .2s ease" }} />
                    </div>

                    {/* Question card */}
                    <div style={{ background: S.panel, border: `1px solid ${S.border}`, borderRadius: 12, padding: "26px 28px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                            <span style={{
                                fontFamily: fontMono, fontSize: 11, fontWeight: 700,
                                padding: "3px 9px", borderRadius: 4,
                                background: "rgba(247,223,30,0.18)", color: S.accent,
                                letterSpacing: "0.04em",
                            }}>{q.topic}</span>
                            {q.trap && (
                                <span style={{
                                    fontFamily: fontMono, fontSize: 11, fontWeight: 700,
                                    padding: "3px 9px", borderRadius: 4,
                                    background: "rgba(138,115,0,0.10)", color: S.accent,
                                }}>PIÈGE</span>
                            )}
                        </div>
                        <h2 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, color: S.text, margin: 0, lineHeight: 1.45 }}>
                            {q.q}
                        </h2>
                        {q.code && (
                            <pre style={{
                                background: S.panelSoft, border: `1px solid ${S.border}`, borderRadius: 8,
                                padding: "14px 16px", margin: "16px 0 0", overflowX: "auto",
                                fontFamily: fontMono, fontSize: 13.5, color: S.code, lineHeight: 1.6, whiteSpace: "pre", textAlign: "left",
                            }}>{q.code}</pre>
                        )}
                        <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
                            {q.options.map((opt, i) => {
                                const isThisCorrect = i === q.correct;
                                const isThisSelected = selectedIdx === i;

                                let bg = S.panelSoft;
                                let borderColor = S.border;
                                let badgeBg = S.border;
                                let badgeColor = S.muted;
                                let opacity = 1;

                                if (!answered) {
                                    // no answer yet — neutral
                                } else if (isThisCorrect) {
                                    bg = "rgba(21,128,61,0.08)";
                                    borderColor = S.green;
                                    badgeBg = S.green;
                                    badgeColor = "#fff";
                                } else if (isThisSelected) {
                                    bg = "rgba(220,38,38,0.08)";
                                    borderColor = S.red;
                                    badgeBg = S.red;
                                    badgeColor = "#fff";
                                } else {
                                    opacity = 0.45;
                                }

                                return (
                                    <button
                                        key={i}
                                        onClick={answered ? undefined : () => {
                                            const next = [...answers];
                                            next[current] = i;
                                            setAnswers(next);
                                        }}
                                        style={{
                                            textAlign: "left",
                                            background: bg,
                                            border: `1px solid ${borderColor}`,
                                            borderRadius: 8,
                                            padding: "13px 16px",
                                            cursor: answered ? "default" : "pointer",
                                            color: S.text,
                                            fontFamily: fontDisplay,
                                            fontSize: 14.5,
                                            display: "flex",
                                            gap: 12,
                                            alignItems: "flex-start",
                                            lineHeight: 1.5,
                                            opacity,
                                            transition: "opacity .15s ease",
                                        }}
                                    >
                                        <span style={{
                                            fontFamily: fontMono, fontSize: 12, fontWeight: 700, flexShrink: 0,
                                            width: 22, height: 22, borderRadius: 5, display: "inline-flex",
                                            alignItems: "center", justifyContent: "center", marginTop: 1,
                                            background: badgeBg,
                                            color: badgeColor,
                                        }}>{String.fromCharCode(65 + i)}</span>
                                        <span>{opt}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Inline correction */}
                        {answered && <ExplCard key={q.id} q={q} subjectId={subject.id} isCorrect={isCorrect} />}
                    </div>

                    {/* Nav */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 12, flexWrap: "wrap" }}>
                        <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}
                                style={navBtn(current === 0)}>← Précédente</button>
                        {current < quizTotal - 1 ? (
                            <button
                                onClick={() => answered && setCurrent(current + 1)}
                                style={{
                                    ...navBtn(!answered, true),
                                    ...(answered ? { background: S.yellow, color: "#000", fontWeight: 700 } : {}),
                                }}>
                                Suivante →
                            </button>
                        ) : (
                            <button
                                onClick={() => answered && finish()}
                                style={{
                                    ...navBtn(!answered, true),
                                    ...(answered ? { background: S.yellow, color: "#000", fontWeight: 700 } : {}),
                                }}>
                                Voir les résultats
                            </button>
                        )}
                    </div>

                    {/* Question navigator */}
                    <div style={{ marginTop: 26 }}>
                        <div style={{ fontFamily: fontMono, fontSize: 11, color: S.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Navigation</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {quiz.map((q2, i) => {
                                const a = answers[i];
                                const done = a !== null;
                                const ok = done && a === q2.correct;
                                return (
                                    <button key={i} onClick={() => setCurrent(i)}
                                            style={{
                                                width: 34, height: 30, borderRadius: 6, cursor: "pointer",
                                                fontFamily: fontMono, fontSize: 12,
                                                border: `1px solid ${i === current ? S.yellow : done ? (ok ? S.green : S.red) : S.border}`,
                                                background: done ? (ok ? "rgba(21,128,61,0.10)" : "rgba(220,38,38,0.10)") : S.panelSoft,
                                                color: i === current ? S.accent : done ? (ok ? S.green : S.red) : S.muted,
                                                fontWeight: i === current ? 700 : 400,
                                            }}>{i + 1}</button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Shell>
        );
    }

    // ------------------------------------------------ SINGLE QUESTION (direct URL)
    if (screen === "single") {
        const q = singleQuestion;
        const answered = singleAnswer !== null;
        const isCorrect = singleAnswer === q.correct;
        return (
            <Shell>
                <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px 48px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                        <SubjectBadge subj={subject} small />
                        <span style={{ fontFamily: fontMono, fontSize: 13, color: S.muted }}>
                            {subject.label} · question #{q.id}
                        </span>
                        {q.trap && (
                            <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: "rgba(138,115,0,0.10)", color: S.accent }}>PIÈGE</span>
                        )}
                    </div>

                    <div style={{ background: S.panel, border: `1px solid ${S.border}`, borderRadius: 12, padding: "26px 28px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: "rgba(247,223,30,0.18)", color: S.accent, letterSpacing: "0.04em" }}>{q.topic}</span>
                            {q.trap && <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: "rgba(138,115,0,0.10)", color: S.accent }}>PIÈGE</span>}
                        </div>
                        <h2 style={{ fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, color: S.text, margin: 0, lineHeight: 1.45 }}>{q.q}</h2>
                        {q.code && (
                            <pre style={{ background: S.panelSoft, border: `1px solid ${S.border}`, borderRadius: 8, padding: "14px 16px", margin: "16px 0 0", overflowX: "auto", fontFamily: fontMono, fontSize: 13.5, color: S.code, lineHeight: 1.6, whiteSpace: "pre", textAlign: "left" }}>{q.code}</pre>
                        )}
                        <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
                            {q.options.map((opt, i) => {
                                const isThisCorrect = i === q.correct;
                                const isThisSelected = singleAnswer === i;
                                let bg = S.panelSoft, borderColor = S.border, badgeBg = S.border, badgeColor = S.muted, opacity = 1;
                                if (answered) {
                                    if (isThisCorrect) { bg = "rgba(21,128,61,0.08)"; borderColor = S.green; badgeBg = S.green; badgeColor = "#fff"; }
                                    else if (isThisSelected) { bg = "rgba(220,38,38,0.08)"; borderColor = S.red; badgeBg = S.red; badgeColor = "#fff"; }
                                    else { opacity = 0.45; }
                                }
                                return (
                                    <button key={i} onClick={answered ? undefined : () => setSingleAnswer(i)}
                                        style={{ textAlign: "left", background: bg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: "13px 16px", cursor: answered ? "default" : "pointer", color: S.text, fontFamily: fontDisplay, fontSize: 14.5, display: "flex", gap: 12, alignItems: "flex-start", lineHeight: 1.5, opacity, transition: "opacity .15s ease" }}>
                                        <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 700, flexShrink: 0, width: 22, height: 22, borderRadius: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1, background: badgeBg, color: badgeColor }}>{String.fromCharCode(65 + i)}</span>
                                        <span>{opt}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {answered && <ExplCard key={q.id} q={q} subjectId={subject.id} isCorrect={isCorrect} />}
                    </div>

                    <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                        <button onClick={() => { backToSubject(); setSingleQuestion(null); setSingleAnswer(null); }}
                            style={{ ...navBtn(false, true), background: S.yellow, color: "#000", fontWeight: 700 }}>
                            Faire le QCM complet →
                        </button>
                        <button onClick={restart} style={navBtn(false)}>Changer de matière</button>
                    </div>
                </div>
            </Shell>
        );
    }

    // ------------------------------------------------ RESULTS
    const pct = Math.round((score / quizTotal) * 100);
    const trapResults = quiz.map((q, i) => ({ q, i, ok: answers[i] === q.correct, edited: isExplEdited(subject.id, q.id) }));
    const trapTotal = quiz.filter((q) => q.trap).length;
    const trapOk = trapResults.filter((r) => r.q.trap && r.ok).length;
    const shown = trapResults.filter((r) => (filter === "all" ? true : filter === "wrong" ? !r.ok : r.edited));

    return (
        <Shell>
            <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 24px 60px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
                    <SubjectBadge subj={subject} small />
                    <h1 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 700, color: S.text, margin: 0 }}>Correction</h1>
                    <span style={{ fontFamily: fontMono, fontSize: 12, color: S.muted }}>({subject.label} · {difficulty.label})</span>
                </div>

                {/* Score */}
                <div style={{ background: S.panel, border: `1px solid ${S.border}`, borderRadius: 12, padding: "24px 28px", display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                        <div style={{ fontFamily: fontDisplay, fontSize: 46, fontWeight: 700, color: pct >= 50 ? S.green : S.red, lineHeight: 1 }}>
                            {score}<span style={{ fontSize: 22, color: S.muted }}> / {quizTotal}</span>
                        </div>
                        <div style={{ fontFamily: fontMono, fontSize: 13, color: S.muted, marginTop: 6 }}>{pct}% de réussite</div>
                    </div>
                    <div style={{ fontFamily: fontDisplay, fontSize: 13.5, color: S.muted, lineHeight: 1.8 }}>
                        <div>Questions pièges : <span style={{ color: S.text, fontFamily: fontMono }}>{trapOk}/{trapTotal}</span></div>
                        <div>Questions de cours : <span style={{ color: S.text, fontFamily: fontMono }}>{score - trapOk}/{quizTotal - trapTotal}</span></div>
                        <div>Sans réponse : <span style={{ color: S.text, fontFamily: fontMono }}>{answers.filter((a) => a === null).length}</span></div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={() => start(difficulty)} style={navBtn(false)}>Rejouer ({difficulty.label})</button>
                        <button onClick={backToSubject} style={navBtn(false)}>Changer la difficulté</button>
                        <button onClick={restart} style={{ ...navBtn(false, true), background: S.yellow, color: "#000", fontWeight: 700 }}>
                            Changer de matière
                        </button>
                    </div>
                </div>

                {/* Filter */}
                <div style={{ display: "flex", gap: 8, margin: "26px 0 16px" }}>
                    {[
                        ["all", "Toutes les questions"],
                        ["wrong", `Erreurs (${trapResults.filter((r) => !r.ok).length})`],
                        ["edited", `Modifiées (${trapResults.filter((r) => r.edited).length})`],
                    ].map(([id, label]) => (
                        <button key={id} onClick={() => setFilter(id)}
                                style={{
                                    ...navBtn(false),
                                    background: filter === id ? "rgba(247,223,30,0.14)" : S.panelSoft,
                                    borderColor: filter === id ? S.yellow : S.border,


                                    color: filter === id ? S.accent : S.muted,
                                }}>{label}</button>
                    ))}
                </div>

                {/* Corrections */}
                <div style={{ display: "grid", gap: 16 }}>
                    {shown.length === 0 && (
                        <div style={{ color: S.green, fontFamily: fontDisplay, fontSize: 15, padding: "18px 0" }}>
                            Aucune erreur. Passe à la difficulté supérieure.
                        </div>
                    )}
                    {shown.map(({ q, i, ok }) => (
                        <div key={i} style={{
                            background: S.panel, borderRadius: 12, padding: "20px 24px",
                            border: `1px solid ${S.border}`,
                            borderLeft: `4px solid ${ok ? S.green : S.red}`,
                        }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: fontMono, fontSize: 12, color: S.muted }}>Q{i + 1}</span>
                                <span style={{
                                    fontFamily: fontMono, fontSize: 11, fontWeight: 700,
                                    padding: "2px 8px", borderRadius: 4,
                                    background: ok ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                                    color: ok ? S.green : S.red,
                                }}>{ok ? "CORRECT" : answers[i] === null ? "SANS RÉPONSE" : "FAUX"}</span>
                                {q.trap && (
                                    <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(138,115,0,0.12)", color: S.accent }}>
                    PIÈGE
                  </span>
                                )}
                            </div>
                            <div style={{ fontFamily: fontDisplay, fontSize: 15.5, fontWeight: 600, color: S.text, lineHeight: 1.5 }}>{q.q}</div>
                            {q.code && (
                                <pre style={{ background: S.panelSoft, border: `1px solid ${S.border}`, borderRadius: 8, padding: "12px 14px", margin: "12px 0 0", overflowX: "auto", fontFamily: fontMono, fontSize: 13, color: S.code, lineHeight: 1.6, whiteSpace: "pre", textAlign: "left" }}>{q.code}</pre>
                            )}
                            <div style={{ marginTop: 14, display: "grid", gap: 6, fontSize: 13.5, fontFamily: fontDisplay, lineHeight: 1.55 }}>
                                {!ok && answers[i] !== null && (
                                    <div style={{ color: S.red }}>✗ Ta réponse : {q.options[answers[i]]}</div>
                                )}
                                <div style={{ color: S.green }}>✓ Bonne réponse : {q.options[q.correct]}</div>
                            </div>
                            <ExplCard q={q} subjectId={subject.id} />
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 10 }}>
                    <button onClick={backToSubject} style={{ ...navBtn(false, true), background: S.yellow, color: "#000", fontWeight: 700, padding: "12px 28px" }}>
                        Changer la difficulté
                    </button>
                    <button onClick={restart} style={{ ...navBtn(false), padding: "12px 28px" }}>
                        Changer de matière
                    </button>
                </div>
            </div>
        </Shell>
    );
}

// ============================================================
// Composants utilitaires
// ============================================================
function Shell({ children }) {
    return (

        <div style={{ minHeight: "100vh", background: S.bg, colorScheme: "light" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid ${S.yellow}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>
            {children}
        </div>
    );
}

function SubjectBadge({ subj, small }) {
    const size = small ? 34 : 56;
    return (
        <div style={{
            width: size, height: size, background: subj.badgeColor, borderRadius: small ? 6 : 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: fontMono, fontWeight: 700, fontSize: small ? 11 : 16,
            color: subj.badgeTextColor,
            userSelect: "none", flexShrink: 0, letterSpacing: "0.02em",
        }}>{subj.badge}</div>
    );
}

const editBtn = {
    fontFamily: fontMono, fontSize: 11, padding: "3px 8px", borderRadius: 4,
    border: `1px solid ${S.border}`, background: S.panelSoft, color: S.muted, cursor: "pointer",
};

// ------------------------------------------------ MINI MARKDOWN
// Supports: fenced ```code``` blocks, `inline code`, **bold**, *italic*/_italic_,
// [links](https://example.com), "- " / "1. " lists, and paragraphs separated by blank lines.
const inlineCodeStyle = {
    fontFamily: fontMono, fontSize: "0.9em", color: S.code,
    background: S.panelSoft, borderRadius: 4, padding: "1px 5px",
};

function renderInline(str, key) {
    const parts = [];
    const re = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*(.+?)\*\*)|(`([^`]+)`)|(\*(.+?)\*)|(_(.+?)_)/g;
    let last = 0, m, idx = 0;
    while ((m = re.exec(str)) !== null) {
        if (m.index > last) parts.push(str.slice(last, m.index));
        if (m[2] !== undefined) parts.push(
            <a key={`${key}-${idx++}`} href={m[3]} target="_blank" rel="noreferrer" style={{ color: S.code, textDecoration: "underline" }}>
                {m[2]}
            </a>
        );
        else if (m[5] !== undefined) parts.push(<strong key={`${key}-${idx++}`}>{m[5]}</strong>);
        else if (m[7] !== undefined) parts.push(<code key={`${key}-${idx++}`} style={inlineCodeStyle}>{m[7]}</code>);
        else if (m[9] !== undefined) parts.push(<em key={`${key}-${idx++}`}>{m[9]}</em>);
        else if (m[11] !== undefined) parts.push(<em key={`${key}-${idx++}`}>{m[11]}</em>);
        last = re.lastIndex;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
}

function parseMarkdownBlocks(text) {
    const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        const fence = lines[i].match(/^```\s*(\S*)\s*$/);
        if (fence) {
            const codeLines = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) { codeLines.push(lines[i]); i++; }
            i++; // skip closing fence
            blocks.push({ type: "code", content: codeLines.join("\n") });
            continue;
        }
        if (lines[i].trim() === "") { i++; continue; }
        const list = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (list) {
            const ordered = /\d+\./.test(list[1]);
            const items = [];
            while (i < lines.length) {
                const m2 = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
                if (!m2) break;
                items.push(m2[2]);
                i++;
            }
            blocks.push({ type: "list", ordered, items });
            continue;
        }
        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
            paraLines.push(lines[i]);
            i++;
        }
        blocks.push({ type: "para", lines: paraLines });
    }
    return blocks;
}

function Markdown({ text }) {
    const blocks = parseMarkdownBlocks(text);
    return blocks.map((b, bi) => {
        if (b.type === "code") {
            return (
                <pre key={bi} style={{ background: S.panelSoft, border: `1px solid ${S.border}`, borderRadius: 8, padding: "12px 14px", margin: "10px 0", overflowX: "auto", fontFamily: fontMono, fontSize: 13, color: S.code, lineHeight: 1.6, whiteSpace: "pre", textAlign: "left" }}>{b.content}</pre>
            );
        }
        if (b.type === "list") {
            const Tag = b.ordered ? "ol" : "ul";
            return (
                <Tag key={bi} style={{ margin: "6px 0", paddingLeft: 22 }}>
                    {b.items.map((item, ii) => <li key={ii} style={{ marginBottom: 2 }}>{renderInline(item, `${bi}-${ii}`)}</li>)}
                </Tag>
            );
        }
        return (
            <p key={bi} style={{ margin: bi === 0 ? "0 0 8px" : "8px 0" }}>
                {b.lines.map((line, li) => (
                    <Fragment key={li}>
                        {li > 0 && <br />}
                        {renderInline(line, `${bi}-${li}`)}
                    </Fragment>
                ))}
            </p>
        );
    });
}

function ExplCard({ q, subjectId, isCorrect }) {
    const lsKey = `expl_${subjectId}_${q.id}`;
    const codeLsKey = `explCode_${subjectId}_${q.id}`;

    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(() => localStorage.getItem(lsKey) ?? q.expl);
    const isEdited = isExplEdited(subjectId, q.id);

    const [editingCode, setEditingCode] = useState(false);
    const [codeText, setCodeText] = useState(() => {
        const s = localStorage.getItem(codeLsKey);
        return s !== null ? s : (q.explCode ?? "");
    });
    const codeSaved = localStorage.getItem(codeLsKey);
    const effectiveCode = codeSaved !== null ? codeSaved : (q.explCode ?? "");
    const isCodeEdited = codeSaved !== null;

    const save = () => { localStorage.setItem(lsKey, text); setEditing(false); };
    const cancel = () => { setText(localStorage.getItem(lsKey) ?? q.expl); setEditing(false); };
    const reset = () => { localStorage.removeItem(lsKey); setText(q.expl); setEditing(false); };

    const saveCode = () => { localStorage.setItem(codeLsKey, codeText); setEditingCode(false); };
    const cancelCode = () => { setCodeText(localStorage.getItem(codeLsKey) ?? (q.explCode ?? "")); setEditingCode(false); };
    const resetCode = () => { localStorage.removeItem(codeLsKey); setCodeText(q.explCode ?? ""); setEditingCode(false); };

    const hasResult = isCorrect !== undefined;
    const bg = hasResult ? (isCorrect ? "rgba(21,128,61,0.06)" : "rgba(220,38,38,0.06)") : S.panelSoft;
    const borderColor = hasResult ? (isCorrect ? S.green : S.red) : S.border;

    return (
        <div style={{ marginTop: hasResult ? 18 : 12, padding: hasResult ? "14px 16px" : "12px 14px", borderRadius: 8, background: bg, border: `1px solid ${borderColor}` }}>
            {/* Expl text header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: hasResult || editing ? 6 : 0, textAlign: "left" }}>
                {hasResult ? (
                    <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 700, color: isCorrect ? S.green : S.red }}>
                        {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                        {q.trap && <span style={{ marginLeft: 10, color: S.accent }}>PIÈGE</span>}
                    </div>
                ) : <span />}
                <div style={{ display: "flex", gap: 4, marginLeft: 8, flexShrink: 0 }}>
                    {!editing && <button onClick={() => { setText(localStorage.getItem(lsKey) ?? q.expl); setEditing(true); }} style={editBtn}>✎</button>}
                    {!editing && isEdited && <button onClick={reset} style={{ ...editBtn, color: S.accent }} title="Réinitialiser">↺</button>}
                </div>
            </div>

            {/* Expl text */}
            {editing ? (
                <>
                    <textarea value={text} onChange={e => setText(e.target.value)} autoFocus
                        style={{ width: "100%", boxSizing: "border-box", fontFamily: fontMono, fontSize: 13, lineHeight: 1.65, color: S.text, background: S.panel, border: `1px solid ${S.border}`, borderRadius: 6, padding: "10px 12px", resize: "vertical", minHeight: 90, outline: "none", display: "block" }}
                    />
                    <div style={{ fontFamily: fontMono, fontSize: 11, color: S.muted, marginTop: 6 }}>
                        Markdown : **gras**, *italique*, `code`, listes "- ", et blocs ```code```
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={save} style={{ ...editBtn, background: S.yellow, color: "#000", fontWeight: 700, borderColor: S.yellow }}>Enregistrer</button>
                        <button onClick={cancel} style={editBtn}>Annuler</button>
                    </div>
                </>
            ) : (
                <div style={{ fontFamily: fontDisplay, fontSize: 13.5, color: S.text, lineHeight: 1.65, wordBreak: "break-word", textAlign: "left" }}>
                    <Markdown text={text} />
                </div>
            )}

            {/* Code block */}
            {editingCode ? (
                <div style={{ marginTop: 10 }}>
                    <textarea value={codeText} onChange={e => setCodeText(e.target.value)} autoFocus
                        style={{ width: "100%", boxSizing: "border-box", fontFamily: fontMono, fontSize: 13, lineHeight: 1.6, color: S.code, background: S.panelSoft, border: `1px solid ${S.border}`, borderRadius: 6, padding: "10px 12px", resize: "vertical", minHeight: 80, outline: "none", display: "block" }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={saveCode} style={{ ...editBtn, background: S.yellow, color: "#000", fontWeight: 700, borderColor: S.yellow }}>Enregistrer</button>
                        <button onClick={cancelCode} style={editBtn}>Annuler</button>
                        {isCodeEdited && <button onClick={resetCode} style={{ ...editBtn, color: S.accent }}>↺ Réinitialiser</button>}
                    </div>
                </div>
            ) : effectiveCode ? (
                <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 4 }}>
                        <button onClick={() => { setCodeText(effectiveCode); setEditingCode(true); }} style={editBtn}>✎</button>
                        {isCodeEdited && <button onClick={resetCode} style={{ ...editBtn, color: S.accent }} title="Réinitialiser">↺</button>}
                    </div>
                    <pre style={{ background: S.panelSoft, border: `1px solid ${S.border}`, borderRadius: 8, padding: "12px 14px", margin: 0, overflowX: "auto", fontFamily: fontMono, fontSize: 13, color: S.code, lineHeight: 1.6, whiteSpace: "pre", textAlign: "left" }}>{effectiveCode}</pre>
                </div>
            ) : (
                <button onClick={() => { setCodeText(""); setEditingCode(true); }}
                    style={{ ...editBtn, marginTop: 10, display: "block" }}>+ bloc de code</button>
            )}
        </div>
    );
}

function navBtn(disabled, primary) {
    return {
        background: primary ? S.panel : S.panelSoft,
        border: `1px solid ${S.border}`,
        borderRadius: 8,
        padding: "10px 18px",
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 14,
        color: disabled ? S.muted : S.text,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
    };
}
