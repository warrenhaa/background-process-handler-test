module.exports = (sequelize, DataTypes) => {
  const cameraEvents = sequelize.define('camera_events', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    property_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    property_value: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    camera_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
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
  cameraEvents.associate = function (models) {
    cameraEvents.belongsTo(models.companies, { foreignKey: 'company_id' });
  };
  return cameraEvents;
};
