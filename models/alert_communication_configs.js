module.exports = (sequelize, DataTypes) => {
  const alertCommunicationConfigs = sequelize.define('alert_communication_configs', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    alert_type: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    alert_message: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    occupant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'occupants',
        key: 'id',
      },
    },
    device_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'devices',
        key: 'id',
      },
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      onDelete: 'CASCADE',
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    email_enabled: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    sms_enabled: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    notification_enabled: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
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
    tableName: 'alert_communication_configs',
  });
  alertCommunicationConfigs.associate = (models) => {
    alertCommunicationConfigs.belongsTo(models.occupants, { foreignKey: 'occupant_id' });
    alertCommunicationConfigs.belongsTo(models.users, { foreignKey: 'user_id' });
    alertCommunicationConfigs.belongsTo(models.devices, { foreignKey: 'device_id' });
    alertCommunicationConfigs.belongsTo(models.companies, { foreignKey: 'company_id' });
  };
  return alertCommunicationConfigs;
};
