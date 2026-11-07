import type { Call } from "../api";

type TranscriptProps = {
  call: Call;
  highlightedTurn: number | null;
};

/** A call turn by turn, with the node each turn happened in. */
export function Transcript({ call, highlightedTurn }: TranscriptProps) {
  return (
    <ol className="transcript" aria-label={`Transcript of ${call.id}`} start={0}>
      {call.turns.map((turn, index) => {
        let className = `transcript__turn transcript__turn--${turn.role}`;
        if (index === highlightedTurn) {
          className += " transcript__turn--highlighted";
        }
        return (
          <li key={index} className={className}>
            <span className="transcript__meta">
              {turn.role} · <code>{turn.node}</code>
            </span>
            {turn.text}
          </li>
        );
      })}
    </ol>
  );
}
