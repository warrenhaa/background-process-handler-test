module.exports = (sequelize, DataTypes) => {
  const categories = sequelize.define('categories', {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.INTEGER,
      autoIncrement: true,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
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
    device_class: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    data: {
      allowNull: true,
      type: DataTypes.JSONB,
    },
  }, {});
  categories.associate = function (models) {
    categories.hasMany(models.devices, {
      as: 'devices', foreignKey: 'model', sourceKey: 'model', targetKey: 'model',
    });
  };
  return categories;
};
