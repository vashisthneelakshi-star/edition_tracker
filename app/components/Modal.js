'use client';

export default function Modal({ title, onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,41,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 480, margin: 0, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }} style={{ fontSize: 22, color: 'var(--text-muted)', textDecoration: 'none', lineHeight: 1 }}>
            ×
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
