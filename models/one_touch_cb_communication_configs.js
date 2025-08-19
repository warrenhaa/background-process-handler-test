module.exports = (sequelize, DataTypes) => {
  const oneTouchCbCommunicationConfigs = sequelize.define('one_touch_cb_communication_configs', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    gateway_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    device_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    config_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    camera_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    array_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    occupant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants',
        key: 'id',
      },
    },
    property_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    property_value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ruleop: {
      type: DataTypes.STRING,
      allowNull: true,
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
    tableName: 'one_touch_cb_communication_configs',
  });
  oneTouchCbCommunicationConfigs.associate = (models) => {
    oneTouchCbCommunicationConfigs.belongsTo(models.occupants, { as: 'occupant', foreignKey: 'occupant_id' });
  };
  return oneTouchCbCommunicationConfigs;
};
