module.exports = (sequelize, DataTypes) => {
  const activity_log_communication_configs = sequelize.define('activity_log_communication_configs', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    event_name: {
      type: DataTypes.STRING,
    },
    email_enabled: {
      type: DataTypes.BOOLEAN,
    },
    sms_enabled: {
      type: DataTypes.BOOLEAN,
    },
    notification_enabled: {
      type: DataTypes.BOOLEAN,
    },
    placeholders: {
      type: DataTypes.JSONB,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    company_id: {
      allowNull: true,
      type: DataTypes.UUID,
    }
  }, {});

  return activity_log_communication_configs;
};
