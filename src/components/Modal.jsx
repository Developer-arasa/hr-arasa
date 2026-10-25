import {
  IconBell, IconWarn, IconSuccess, IconError, IconQuestion, IconDoor,
} from './Icons';

const ICON_MAP = {
  bell: IconBell,
  warn: IconWarn,
  warning: IconWarn,
  success: IconSuccess,
  check: IconSuccess,
  error: IconError,
  close: IconError,
  question: IconQuestion,
  help: IconQuestion,
  door: IconDoor,
  logout: IconDoor,
};

export default function Modal({ open, title, icon, msg, onClose, children, alignLeft }) {
  if (!open) return null;
  const IconComponent = typeof icon === 'string' ? ICON_MAP[icon] : null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-box${alignLeft ? ' modal-box--left' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(icon || IconComponent) && (
          <div className={`modal-icon modal-icon--${typeof icon === 'string' ? icon : 'custom'}`}>
            {IconComponent ? <IconComponent /> : icon}
          </div>
        )}
        {title && <h3 className="modal-title">{title}</h3>}
        {msg && <div className="modal-msg">{msg}</div>}
        {children}
      </div>
    </div>
  );
}
