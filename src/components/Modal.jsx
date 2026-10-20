export default function Modal({ open, title, icon, msg, onClose, children, alignLeft }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-box${alignLeft ? ' modal-box--left' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {icon && <div className="modal-icon">{icon}</div>}
        {title && <h3 className="modal-title">{title}</h3>}
        {msg && <div className="modal-msg">{msg}</div>}
        {children}
      </div>
    </div>
  );
}
