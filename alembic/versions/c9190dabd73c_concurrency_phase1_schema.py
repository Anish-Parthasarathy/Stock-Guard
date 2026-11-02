"""concurrency_phase1_schema

Revision ID: c9190dabd73c
Revises: f70661c2dc82
Create Date: 2026-11-01 20:36:10.338076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9190dabd73c'
down_revision: Union[str, Sequence[str], None] = 'f70661c2dc82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with concurrency constraints and indexes."""
    # Composite unique constraint on stock (warehouse_id, product_id)
    op.create_unique_constraint(
        'uq_stock_warehouse_product',
        'stock',
        ['warehouse_id', 'product_id']
    )

    # Check constraints on stock
    op.create_check_constraint(
        'check_stock_quantity',
        'stock',
        'quantity >= 0'
    )
    op.create_check_constraint(
        'check_stock_version',
        'stock',
        'version > 0'
    )
    op.create_check_constraint(
        'check_stock_reorder_threshold',
        'stock',
        'reorder_threshold >= 0'
    )

    # Composite B-tree index on reservation (warehouse_id, product_id, status, expire_at)
    op.create_index(
        'ix_reservation_warehouse_id_product_id_status_expire_at',
        'reservation',
        ['warehouse_id', 'product_id', 'status', 'expire_at'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'ix_reservation_warehouse_id_product_id_status_expire_at',
        table_name='reservation'
    )
    op.drop_constraint('check_stock_reorder_threshold', 'stock', type_='check')
    op.drop_constraint('check_stock_version', 'stock', type_='check')
    op.drop_constraint('check_stock_quantity', 'stock', type_='check')
    op.drop_constraint('uq_stock_warehouse_product', 'stock', type_='unique')
