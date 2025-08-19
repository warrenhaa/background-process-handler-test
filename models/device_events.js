module.exports = (sequelize, DataTypes) => {
  const deviceEvents = sequelize.define('device_events', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    device_code: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    model: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    property_name: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    value: {
      allowNull: false,
      type: DataTypes.JSONB,
    },
    parsed_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    event_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    property_endpoint: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    property_display_name: {
      allowNull: true,
      type: DataTypes.STRING,
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
      tableName: 'device_events',
    });
  deviceEvents.associate = (models) => {
    deviceEvents.belongsTo(models.companies, { foreignKey: 'company_id' });
  };
  return deviceEvents;
};
