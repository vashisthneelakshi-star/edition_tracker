'use client';
import { useState } from 'react';
import Modal from './Modal';

const WORD_LIMIT = 100;

function wordCount(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean).length;
}

export default function ReasonField({ value, onChange, disabled, required, editionLabel }) {
  const [open, setOpen] = useState(false);
  const preview = value?.trim() ? value : (required ? 'Tap to enter reason (required)' : 'Tap to enter reason (optional)');

  return (
    <>
      <div
        onClick={() => !disabled && setOpen(true)}
        className={disabled ? 'locked-field' : ''}
        style={{
          border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
          minHeight: 40, cursor: disabled ? 'not-allowed' : 'pointer',
          color: value?.trim() ? 'var(--text)' : 'var(--text-muted)',
          fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      >
        {preview}
      </div>

      {open && (
        <Modal title={`Reason${editionLabel ? ' — ' + editionLabel : ''}`} onClose={() => setOpen(false)}>
          <textarea
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={6}
            style={{ width: '100%', fontSize: 16, resize: 'vertical' }}
            placeholder="Type the reason here..."
          />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {wordCount(value)}/{WORD_LIMIT} words
          </div>
          <button type="button" onClick={() => setOpen(false)} style={{ width: '100%' }}>Done</button>
        </Modal>
      )}
    </>
  );
}
