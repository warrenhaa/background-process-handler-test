module.exports = (sequelize, DataTypes) => {
    const occupantsDashboardAttributes = sequelize.define('occupants_dashboard_attributes', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
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
        occupant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            onDelete: 'CASCADE',
            references: {
                model: 'occupants',
                key: 'id',
            },
        },
        item_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        grid_order: {
            type: DataTypes.STRING,
            defaultValue: '0',
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
    },
        {
            freezeTableName: true,
            tableName: 'occupants_dashboard_attributes',
        });
    occupantsDashboardAttributes.associate = (models) => {
        occupantsDashboardAttributes.belongsTo(models.occupants, { foreignKey: 'occupant_id', targetKey: 'id' });
        occupantsDashboardAttributes.belongsTo(models.companies, { foreignKey: 'company_id', targetKey: 'id' });
    };
    return occupantsDashboardAttributes;
};
