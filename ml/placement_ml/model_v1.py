"""Set-based correction model v1 — position deltas + delete classification."""
from __future__ import annotations

import torch
import torch.nn as nn

from .features import ML_BOUNDARY_GRID_SIZE, ML_MAX_HEADS, ML_MAX_VERTICES


class PlacementCorrectionModelV1(nn.Module):
    def __init__(
        self,
        poly_dim: int | None = None,
        head_dim: int = 8,
        hidden: int = 128,
        context_dim: int = 3,
    ):
        super().__init__()
        if poly_dim is None:
            poly_dim = ML_MAX_VERTICES * 2 + ML_MAX_VERTICES * 3 + 4 + 7 + ML_BOUNDARY_GRID_SIZE ** 2

        self.poly_encoder = nn.Sequential(
            nn.Linear(poly_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
        )
        self.context_encoder = nn.Linear(context_dim, hidden)
        self.head_encoder = nn.Linear(head_dim, hidden)

        self.head_mlp = nn.Sequential(
            nn.Linear(hidden * 2, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
        )
        self.delta_head = nn.Linear(hidden, 2)
        self.delete_head = nn.Linear(hidden, 1)

    def forward(self, poly: torch.Tensor, heads: torch.Tensor, context: torch.Tensor, head_mask: torch.Tensor):
        # poly: [B, poly_dim], heads: [B, H, head_dim], context: [B, 3], mask: [B, H]
        g_poly = self.poly_encoder(poly)
        g_ctx = self.context_encoder(context)
        g = g_poly + g_ctx  # [B, hidden]

        B, H, D = heads.shape
        g_exp = g.unsqueeze(1).expand(B, H, -1)
        h_in = torch.cat([self.head_encoder(heads), g_exp], dim=-1)
        h = self.head_mlp(h_in)

        delta = self.delta_head(h)
        delete_logit = self.delete_head(h).squeeze(-1)

        delta = delta * head_mask.unsqueeze(-1)
        delete_logit = delete_logit + (1 - head_mask) * (-1e9)
        return delta, delete_logit


def correction_loss(
    pred_delta: torch.Tensor,
    pred_delete: torch.Tensor,
    target_delta: torch.Tensor,
    target_moved: torch.Tensor,
    target_deleted: torch.Tensor,
    head_mask: torch.Tensor,
    *,
    move_weight: float = 1.0,
    delete_weight: float = 0.5,
) -> torch.Tensor:
    mask = head_mask.unsqueeze(-1)
    moved_mask = (target_moved * head_mask).unsqueeze(-1)

    move_loss = torch.nn.functional.huber_loss(
        pred_delta * moved_mask,
        target_delta * moved_mask,
        reduction="sum",
    ) / (moved_mask.sum() + 1e-6)

    delete_loss = torch.nn.functional.binary_cross_entropy_with_logits(
        pred_delete,
        target_deleted,
        weight=head_mask,
        reduction="sum",
    ) / (head_mask.sum() + 1e-6)

    return move_weight * move_loss + delete_weight * delete_loss
