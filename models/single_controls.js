module.exports = (sequelize, DataTypes) => {
  const SingleControls = sequelize.define('single_controls', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    gateway_id: {
      allowNull: false,
      type: DataTypes.UUID,
    },
    default_device_id: {
      allowNull: false,
      type: DataTypes.UUID,
      unique: true,
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
      tableName: 'single_controls',
    });
  SingleControls.associate = (models) => {
    SingleControls.belongsTo(models.devices, { foreignKey: 'gateway_id', targetKey: 'id' });
    SingleControls.belongsTo(models.devices, { foreignKey: 'default_device_id', targetKey: 'id' });
    SingleControls.belongsTo(models.companies, { foreignKey: 'company_id', targetKey: 'id' });
    SingleControls.hasMany(models.single_control_devices, { foreignKey: 'single_control_id', targetKey: 'id' });
  };
  return SingleControls;
};
