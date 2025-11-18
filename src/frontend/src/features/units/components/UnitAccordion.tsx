import React from 'react';
import { Link } from 'react-router-dom';
import type { Unit } from '../services/unitsAPI';
import { useProgress } from '../hooks/useProgress';

export default function UnitAccordion({ unit }: { unit: Unit }) {
  const { hasTakenDiagnostic } = useProgress();
  const passed = hasTakenDiagnostic(unit.id);

  return (
    <div className="unit">
      <div className="unit-header">
        <div>
          <h2>{unit.title}</h2>
          <p className="muted">{unit.description}</p>
        </div>
      </div>

      {!passed && (
        <div className="card diag">
          <div>
            <strong>Diagnostic Test Required</strong>
            <p className="muted">Take a quick diagnostic test to personalize your learning path</p>
          </div>
          <Link to={`/units/${unit.id}/diagnostic`} className="btn primary">Take diagnostic</Link>
        </div>
      )}

      <div className="sections">
        {unit.sections.map(s => {
          const locked = !passed;
          return (
            <div
              key={s.id}
              className={`row ${locked ? 'locked' : ''}`}
              aria-disabled={locked}
              tabIndex={locked ? -1 : 0}
              role="button"
              onKeyDown={(e) => {
                if (!locked && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  // future: navigate to section practice if needed
                }
              }}
            >
              <span>{s.title}</span>
              <span className="badge">{locked ? 'Locked' : 'Unlocked'}</span>
            </div>
          );
        })}
      </div>

      <div className={`cta ${passed ? '' : 'disabled'}`} aria-disabled={!passed}>
        <div>
          <strong>Comprehensive Unit Test</strong>
          <p className="muted">Test your knowledge of all topics in this unit</p>
        </div>
        {passed
          ? <Link to={`/units/${unit.id}/test`} className="btn orange" aria-label="Start Unit Quiz">Start Unit Quiz</Link>
          : <button className="btn orange" disabled aria-disabled={true} aria-label="Diagnostic required">Start Unit Quiz</button>}
      </div>
    </div>
  );
}
