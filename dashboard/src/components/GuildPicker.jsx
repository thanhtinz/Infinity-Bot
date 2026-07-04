import { GUILD_PLACEHOLDER } from '../lib/format';
import EmptyState from './EmptyState';

export default function GuildPicker({ guilds, onSelect, onClose, notice }) {
  const hasGuilds = (guilds || []).length > 0;

  return (
    <div className="modal-overlay guild-picker-overlay">
      <div className="modal-card guild-picker-card glass-panel">
        {onClose && (
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        )}
        <h2>Choose a server</h2>
        <p className="modal-subtitle">Pick which Discord server you want to manage with Infinity Bot.</p>
        {notice && (
          <div className="inline-notice">
            <i className="fa-solid fa-circle-info" /> {notice}
          </div>
        )}

        {hasGuilds ? (
          <div className="guild-grid">
            {guilds.map((guild) => (
              <div key={guild.id} className={`guild-card ${guild.hasBot ? 'selectable' : ''}`}>
                <img src={guild.icon || GUILD_PLACEHOLDER} alt="" className="guild-card-icon" />
                <h3>{guild.name}</h3>
                {typeof guild.memberCount === 'number' && (
                  <p className="guild-card-meta">
                    <i className="fa-solid fa-users" /> {guild.memberCount.toLocaleString()} members
                  </p>
                )}
                {guild.hasBot ? (
                  <button type="button" className="btn-primary" onClick={() => onSelect(guild.id)}>
                    Manage Server
                  </button>
                ) : (
                  <a
                    className="btn-secondary"
                    href={guild.inviteUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" /> Invite to Server
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="fa-server"
            title="No manageable servers found"
            message="You need Administrator or Manage Server permission on a Discord server for it to show up here."
          />
        )}
      </div>
    </div>
  );
}
