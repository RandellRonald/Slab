import { ArrowRight, Bot, MessageSquare, Minus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supportQuestions } from "../../support/supportContent";
import { Button } from "../ui/Button";

type ChatMessage = {
  id: string;
  from: "bot" | "user";
  lines: string[];
};

const greeting = "Hi! Welcome to SLAB 👋";

export function SlabChatbot() {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "hello", from: "bot", lines: [greeting, "How can we help you today?"] },
  ]);
  const historyRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("slab:open-chatbot", openChat);
    return () => window.removeEventListener("slab:open-chatbot", openChat);
  }, []);

  useEffect(() => {
    if (!open) return;
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  function ask(question: string) {
    const match = supportQuestions.find((item) => item.question === question);
    if (!match || typing) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, from: "user", lines: [question] }]);
    setTyping(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, { id: `bot-${Date.now()}`, from: "bot", lines: match.answer }]);
      setTyping(false);
    }, 520);
  }

  function startBooking() {
    setOpen(false);
    navigate("/booking");
  }

  return (
    <div className="slab-chatbot" aria-live="polite">
      <button className="slab-chatbot__launcher" type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Chat with SLAB support">
        <SlabBotMark small />
        <span>Chat with us</span>
      </button>

      {open ? (
        <section className="slab-chatbot__panel" role="dialog" aria-label="SLAB support chatbot">
          <header className="slab-chatbot__header">
            <div className="slab-chatbot__identity">
              <SlabBotMark />
              <div>
                <p>SLAB Support</p>
                <span>Construction assistant</span>
              </div>
            </div>
            <div className="slab-chatbot__controls">
              <button type="button" onClick={() => setOpen(false)} aria-label="Minimize chat"><Minus size={17} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat"><X size={17} /></button>
            </div>
          </header>

          <div className="slab-chatbot__history" ref={historyRef}>
            {messages.map((message) => (
              <article className={`slab-chatbot__bubble slab-chatbot__bubble--${message.from}`} key={message.id}>
                {message.lines.map((line, index) => {
                  const listLike = /^\d+\. /.test(line) || ["Excavators", "JCB / Backhoe", "Cranes", "Tippers", "Septic Tank Services", "Waste Management Services"].includes(line);
                  return <p className={listLike ? "slab-chatbot__list-line" : ""} key={`${message.id}-${index}`}>{line}</p>;
                })}
              </article>
            ))}
            {typing ? (
              <div className="slab-chatbot__typing" aria-label="SLAB is typing">
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </div>

          <div className="slab-chatbot__quick">
            {supportQuestions.map((item) => (
              <button key={item.question} type="button" onClick={() => ask(item.question)}>{item.question}</button>
            ))}
          </div>

          <footer className="slab-chatbot__footer">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); navigate("/support"); }}>Contact Support</Button>
            <Button type="button" onClick={startBooking}>Start Booking <ArrowRight size={15} /></Button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

function SlabBotMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "slab-bot-mark slab-bot-mark--small" : "slab-bot-mark"} aria-hidden="true">
      <span className="slab-bot-mark__helmet" />
      <span className="slab-bot-mark__face">
        <span />
        <span />
      </span>
      <Bot className="slab-bot-mark__spark" size={small ? 12 : 14} />
    </span>
  );
}
