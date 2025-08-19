module.exports = (sequelize, DataTypes) => {
  const activityConfigs = sequelize.define('activity_configs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    send_email: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    send_sms: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      onDelete: 'CASCADE',
      references: {
        model: 'companies',
        key: 'id',
      },
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

  activityConfigs.associate = (models) => {
    activityConfigs.belongsTo(models.companies, { foreignKey: 'company_id' });
  };

  return activityConfigs;
};
