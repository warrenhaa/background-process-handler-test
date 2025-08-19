module.exports = (sequelize, DataTypes) => {
  const predefined_rules = sequelize.define('predefined_rules', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    rule: {
      allowNull: false,
      type: DataTypes.JSONB,
    },
    action_code: {
      allowNull: false,
      unique: true,
      type: DataTypes.STRING,
    },
    source_device_id: {
      allowNull: false,
      unique: true,
      type: DataTypes.UUID,
    },
    target_device_id: {
      allowNull: false,
      unique: true,
      type: DataTypes.UUID,
    },
    gateway_id: {
      allowNull: false,
      unique: true,
      type: DataTypes.UUID,
    },
    company_id: {
      allowNull: false,
      type: DataTypes.UUID,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  }, {});
  predefined_rules.associate = (models) => {
    predefined_rules.belongsTo(models.companies, { foreignKey: 'company_id' });
    predefined_rules.belongsTo(models.devices, { foreignKey: 'gateway_id' });
    predefined_rules.belongsTo(models.devices, { foreignKey: 'source_device_id' });
    predefined_rules.belongsTo(models.devices, { foreignKey: 'target_device_id' });
  };
  return predefined_rules;
};
