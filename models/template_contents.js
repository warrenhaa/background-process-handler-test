module.exports = (sequelize, DataTypes) => {
  const template_contents = sequelize.define('template_contents', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    key: {
      type: DataTypes.STRING,
    },
    language: {
      type: DataTypes.STRING,
    },
    email_config: {
      type: DataTypes.JSONB,
    },
    notification_config: {
      type: DataTypes.JSONB,
    },
    sms_config: {
      type: DataTypes.JSONB,
    },
    type: {
      type: DataTypes.STRING,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    }
  }, {});

  return template_contents;
};
