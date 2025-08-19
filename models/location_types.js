module.exports = (sequelize, DataTypes) => {
  const locationTypes = sequelize.define('location_types', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    container_id: {
      type: DataTypes.UUID,
    },
    can_have_devices: {
      type: DataTypes.BOOLEAN,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_address_applicable: {
      type: DataTypes.BOOLEAN,
    },
    is_location_map_applicable: {
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
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
  }, {});
  locationTypes.associate = function (models) {
    locationTypes.belongsTo(models.companies, { foreignKey: 'company_id' });
  };
  return locationTypes;
};
