import { useState } from "react";

type PostTurnRatings = {
  perceivedUrgency: number;
  perceivedRisk: number;
  confidence: number;
};

type PostTurnRatingPanelProps = {
  disabled?: boolean;
  onSubmit: (ratings: PostTurnRatings) => void;
};

type RatingKey = keyof PostTurnRatings;

const ratingItems: Array<{
  key: RatingKey;
  label: string;
  leftLabel: string;
  rightLabel: string;
}> = [
  {
    key: "perceivedUrgency",
    label: "How urgent you feel about this case?",
    leftLabel: "Not urgent",
    rightLabel: "Very urgent",
  },
  {
    key: "perceivedRisk",
    label: "How risky you feel this case is?",
    leftLabel: "Low risk",
    rightLabel: "High risk",
  },
  {
    key: "confidence",
    label: "How certain are you about the final decision?",
    leftLabel: "Not certain",
    rightLabel: "Very certain",
  },
];

export function PostTurnRatingPanel({
  disabled = false,
  onSubmit,
}: PostTurnRatingPanelProps) {
  const [ratings, setRatings] = useState<Partial<PostTurnRatings>>({});

  const allRatingsCompleted = ratingItems.every(
    (item) => ratings[item.key] !== undefined,
  );

  function updateRating(key: RatingKey, value: string) {
    setRatings((currentRatings) => ({
      ...currentRatings,
      [key]: Number(value),
    }));
  }

  function submitRatings() {
    if (!allRatingsCompleted || disabled) return;

    onSubmit({
      perceivedUrgency: ratings.perceivedUrgency ?? 0,
      perceivedRisk: ratings.perceivedRisk ?? 0,
      confidence: ratings.confidence ?? 0,
    });
  }

  return (
    <section className="post-turn-rating-panel" aria-label="Post-turn ratings">
      <div className="post-turn-rating-header">
        <h2>Rate this response</h2>
      </div>

      <div className="post-turn-rating-fields">
        {ratingItems.map((item) => {
          const value = ratings[item.key];

          return (
            <label className="post-turn-rating-field" key={item.key}>
              <span className="post-turn-rating-label">
                {item.label}
                {value !== undefined ? (
                  <strong>{value}</strong>
                ) : (
                  <strong className="rating-unset">Not set</strong>
                )}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={value ?? 50}
                disabled={disabled}
                onChange={(event) => updateRating(item.key, event.target.value)}
              />
              <span className="post-turn-rating-scale">
                <span>{item.leftLabel}</span>
                <span>{item.rightLabel}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="post-turn-rating-actions">
        <button
          type="button"
          disabled={disabled || !allRatingsCompleted}
          onClick={submitRatings}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
