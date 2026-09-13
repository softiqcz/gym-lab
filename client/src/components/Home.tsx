import { useEffect, useLayoutEffect, useRef, useState } from "react";
import definitions from "../data/workouts.json";
import exercises from "../data/exercises.json";
import schedule from "../data/schedule.json";
const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export default function Home({
  loaded,
  onStart,
}: {
  loaded: boolean;
  onStart: (id: string) => void;
}) {
  const today = (new Date().getDay() + 6) % 7;
  const [dayIndex, setDayIndex] = useState(today);
  const track = useRef<HTMLDivElement>(null);
  const current = useRef(today);
  const frame = useRef(0);
  const week = days.map((day) => ({ day, workoutId: schedule[day] }));
  function move(index: number, smooth = true) {
    const container = track.current;
    const slide = container?.children[index] as HTMLElement | undefined;
    if (!container || !slide) return;
    container.scrollTo({
      left:
        slide.offsetLeft -
        container.offsetLeft -
        (container.clientWidth - slide.clientWidth) / 2,
      behavior:
        smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
  }
  useLayoutEffect(() => {
    move(today, false);
    const observer = new ResizeObserver(() => move(current.current, false));
    if (track.current) observer.observe(track.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);
  function onScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const container = track.current;
      if (!container) return;
      const center = container.scrollLeft + container.clientWidth / 2;
      let nearest = 0;
      let distance = Infinity;
      Array.from(container.children).forEach((child, index) => {
        const slide = child as HTMLElement;
        const diff = Math.abs(
          slide.offsetLeft -
            container.offsetLeft +
            slide.clientWidth / 2 -
            center,
        );
        if (diff < distance) {
          distance = diff;
          nearest = index;
        }
      });
      current.current = nearest;
      setDayIndex(nearest);
    });
  }
  useEffect(() => {
    function navigateDay(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.closest('input,select,textarea,[role="textbox"]'))
      )
        return;
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      move(
        Math.max(
          0,
          Math.min(
            days.length - 1,
            current.current + (event.key === "ArrowRight" ? 1 : -1),
          ),
        ),
      );
    }
    window.addEventListener("keydown", navigateDay);
    return () => window.removeEventListener("keydown", navigateDay);
  }, []);
  return (
    <section className="week-home">
      <nav className="week-nav" aria-label="Training days">
        {week.map(({ day }, index) => (
          <button
            key={day}
            className={index === dayIndex ? "day-tab selected" : "day-tab"}
            aria-current={index === dayIndex ? "true" : undefined}
            aria-label={`${day}${index === today ? " · Today" : ""}`}
            onClick={() => move(index)}
          >
            <span>{day.slice(0, 3)}</span>
            <span className="today-dot" aria-hidden="true">
              {index === today ? "•" : "\u00a0"}
            </span>
          </button>
        ))}
      </nav>
      <div
        className="week-carousel"
        ref={track}
        onScroll={onScroll}
        role="region"
        aria-roledescription="carousel"
        aria-label="Daily workouts"
        tabIndex={0}
      >
        {week.map(({ day, workoutId }, index) => {
          const workout = definitions.find((w) => w.id === workoutId);
          const ids = workout?.exercises ?? workout?.activities ?? [];
          const selected = index === dayIndex;
          return (
            <article
              className={`day-slide${selected ? " is-current" : ""}`}
              key={day}
              role="group"
              aria-roledescription="slide"
              aria-label={day}
              inert={!selected}
            >
              <div className="day-intro">
                <h1>{day}</h1>
                <h2>
                  {workout
                    ? workout.name
                        .split(" + ")
                        .map((part) => <span key={part}>{part}</span>)
                    : "Rest day"}
                </h2>
                {workout && (
                <button
                  className="primary day-start"
                  disabled={!loaded}
                  onClick={() => workout && onStart(workout.id)}
                >
                  {workout
                    ? loaded
                      ? "START WORKOUT"
                      : "LOADING HISTORY…"
                    : "REST DAY"}
                  <span>↗</span>
                </button>
                )}
              </div>
              {workout && (
              <div className="day-exercises">
                <div className="section-label">
                  <span className="eyebrow">
                    EXERCISE LINEUP
                  </span>
                  <span className="eyebrow">
                    {workout?.type === "strength" ? "SETS × REPS" : "TIME"}
                  </span>
                </div>
                {ids.map((id) => {
                  const e = exercises.find((e) => e.id === id);
                  return (
                    <div className="lineup-row" key={id}>
                      <span>
                        {e?.name ?? id.charAt(0).toUpperCase() + id.slice(1)}
                      </span>
                      <span className="lineup-target">
                        {e ? `${e.sets} × ${e.targetReps}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
        )}
            </article>
          );
        })}
      </div>
      <section className="optional-workouts" aria-label="Optional workouts">
        <h2 className="eyebrow">OPTIONAL WORKOUTS</h2>
        <div className="optional-workout-list">
          {definitions.filter(workout => workout.optional).map(workout => (
            <button key={workout.id} disabled={!loaded} onClick={() => onStart(workout.id)}>
              <span>{workout.name.replaceAll(' + ', ' ')}</span><span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
