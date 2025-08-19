module.exports = (sequelize, DataTypes) => {
    const jobs = sequelize.define('jobs', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        type: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.STRING,
        },
        input: {
            type: DataTypes.JSONB,
        },
        meta_data: {
            type: DataTypes.JSONB,
        },
        company_id: {
            type: DataTypes.UUID,
        },
        created_by: {
            allowNull: true,
            type: DataTypes.UUID,
        },
        updated_by: {
            allowNull: true,
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
        request_id: {
            allowNull: true,
            type: DataTypes.UUID,
        },
    }, {});
    jobs.associate = (models) => {
        jobs.belongsTo(models.companies, { foreignKey: 'company_id' });
    };
    return jobs;
};