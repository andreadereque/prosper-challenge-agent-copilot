type SaveProblemsProps = {
  validationErrors: string[];
  failure: string;
};

/** Why the last save did not go through: agent errors, or the server itself. */
export function SaveProblems({ validationErrors, failure }: SaveProblemsProps) {
  if (validationErrors.length === 0 && !failure) {
    return null;
  }
  return (
    <div className="save-problems" role="alert">
      {failure && <p className="save-problems__title">Could not save. {failure}</p>}
      {validationErrors.length > 0 && (
        <>
          <p className="save-problems__title">The agent was not saved. Fix these first:</p>
          <ul className="save-problems__list">
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
