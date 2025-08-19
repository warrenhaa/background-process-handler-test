module.exports = (sequelize, DataTypes) => {
  const addresses = sequelize.define('addresses', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    line_1: {
      type: DataTypes.STRING,
    },
    line_2: {
      type: DataTypes.STRING,
    },
    line_3: {
      type: DataTypes.STRING,
    },
    city: {
      type: DataTypes.STRING,
    },
    state: {
      type: DataTypes.STRING,
    },
    country: {
      type: DataTypes.STRING,
    },
    zip_code: {
      type: DataTypes.STRING,
    },
    geo_location: {
      type: DataTypes.JSONB,
    },
    total_area: {
      type: DataTypes.DECIMAL,
    },
  }, {});
  addresses.associate = function (models) {
    addresses.belongsTo(models.companies, { foreignKey: 'company_id', onDelete: 'CASCADE' });
  };
  return addresses;
};
