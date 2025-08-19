module.exports = (sequelize, DataTypes) => {
  const locations = sequelize.define('locations', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
    },
    notes: {
      type: DataTypes.STRING,
    },
    type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'location_types',
        key: 'id',
      },
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    address_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'addresses',
        key: 'id',
      },
    },
    container_id: {
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
    created_by: {
      type: DataTypes.STRING,
    },
    updated_by: {
      type: DataTypes.STRING,
    },
    path: {
      type: DataTypes.JSONB,
    },

  }, {});
  locations.associate = function (models) {
    // associations can be defined here
    locations.belongsTo(models.location_types, { foreignKey: 'type_id' });
    locations.belongsTo(models.addresses, { foreignKey: 'address_id' });
    locations.belongsTo(models.companies, { foreignKey: 'company_id' });
    locations.belongsTo(models.location_types, { as: 'location_types', foreignKey: 'type_id' });
  };
  return locations;
};
