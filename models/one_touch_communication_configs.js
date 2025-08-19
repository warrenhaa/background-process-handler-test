module.exports = (sequelize, DataTypes) => {
  const oneTouchCommunicationConfig = sequelize.define('one_touch_communication_configs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    action_trigger_key: {
      allowNull: false,
      unique: true,
      type: DataTypes.STRING,
    },
    one_touch_rule_id: {
      allowNull: false,
      type: DataTypes.UUID,
    },
    company_id: {
      allowNull: false,
      type: DataTypes.UUID,
    },
    emails: {
      allowNull: false,
      type: DataTypes.JSONB,
    },
    phone_numbers: {
      allowNull: false,
      type: DataTypes.JSONB,
    },
    notification_emails: {
      allowNull: false,
      type: DataTypes.JSONB,
    },
    message: {
      allowNull: false,
      type: DataTypes.TEXT,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  },
    {
      freezeTableName: true,
      tableName: 'one_touch_communication_configs',
    });
  oneTouchCommunicationConfig.associate = (models) => {
    oneTouchCommunicationConfig.belongsTo(models.companies, { foreignKey: 'company_id' });
    oneTouchCommunicationConfig.belongsTo(models.one_touch_rules, { foreignKey: 'one_touch_rule_id' });
  };
  return oneTouchCommunicationConfig;
};
