"""Set-based placement model v2 — predict full head layouts from polygon + context."""
from __future__ import annotations

import torch
import torch.nn as nn

from .features import ML_BOUNDARY_GRID_SIZE, ML_MAX_HEADS, ML_MAX_VERTICES


class PlacementModelV2(nn.Module):
    """Predict up to ML_MAX_HEADS sprinkler heads as absolute normalized layout."""

    def __init__(
        self,
        poly_dim: int | None = None,
        head_dim: int = 8,
        hidden: int = 128,
        context_dim: int = 3,
        num_slots: int = ML_MAX_HEADS,
    ):
        super().__init__()
        if poly_dim is None:
            poly_dim = (
                ML_MAX_VERTICES * 2
                + ML_MAX_VERTICES * 3
                + 4
                + 7
                + ML_BOUNDARY_GRID_SIZE**2
            )

        self.num_slots = num_slots
        self.poly_encoder = nn.Sequential(
            nn.Linear(poly_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
        )
        self.context_encoder = nn.Linear(context_dim, hidden)
        self.head_encoder = nn.Linear(head_dim, hidden)
        self.pool_proj = nn.Linear(hidden, hidden)
        self.slot_embed = nn.Embedding(num_slots, hidden)

        self.slot_mlp = nn.Sequential(
            nn.Linear(hidden * 2, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
        )
        self.exist_head = nn.Linear(hidden, 1)
        self.pos_head = nn.Linear(hidden, 2)
        self.radius_head = nn.Linear(hidden, 1)
        self.arc_head = nn.Linear(hidden, 1)
        self.rotation_head = nn.Linear(hidden, 1)
        self.nozzle_head = nn.Linear(hidden, 1)
        self.body_head = nn.Linear(hidden, 1)

    def forward(
        self,
        poly: torch.Tensor,
        heads: torch.Tensor,
        context: torch.Tensor,
        head_mask: torch.Tensor,
    ):
        g_poly = self.poly_encoder(poly)
        g_ctx = self.context_encoder(context)

        h_enc = self.head_encoder(heads)
        mask = head_mask.unsqueeze(-1)
        pooled = (h_enc * mask).sum(dim=1) / (mask.sum(dim=1) + 1e-6)
        g = g_poly + g_ctx + self.pool_proj(pooled)

        b = g.shape[0]
        slot_e = self.slot_embed.weight.unsqueeze(0).expand(b, -1, -1)
        g_exp = g.unsqueeze(1).expand(b, self.num_slots, -1)
        h = self.slot_mlp(torch.cat([g_exp, slot_e], dim=-1))

        exist_logit = self.exist_head(h).squeeze(-1)
        pos = torch.sigmoid(self.pos_head(h))
        radius = torch.nn.functional.softplus(self.radius_head(h))
        arc = torch.sigmoid(self.arc_head(h))
        rotation = torch.sigmoid(self.rotation_head(h))
        nozzle = self.nozzle_head(h).squeeze(-1)
        body = self.body_head(h).squeeze(-1)

        return exist_logit, pos, radius, arc, rotation, nozzle, body


def placement_loss(
    pred_exist: torch.Tensor,
    pred_pos: torch.Tensor,
    pred_radius: torch.Tensor,
    pred_arc: torch.Tensor,
    pred_rotation: torch.Tensor,
    pred_nozzle: torch.Tensor,
    pred_body: torch.Tensor,
    target_exist: torch.Tensor,
    target_pos: torch.Tensor,
    target_radius: torch.Tensor,
    target_arc: torch.Tensor,
    target_rotation: torch.Tensor,
    target_nozzle: torch.Tensor,
    target_body: torch.Tensor,
    *,
    exist_weight: float = 1.0,
    geom_weight: float = 1.0,
) -> torch.Tensor:
    exist_loss = torch.nn.functional.binary_cross_entropy_with_logits(
        pred_exist, target_exist, reduction="mean"
    )

    mask = target_exist.unsqueeze(-1)
    count = target_exist.sum() + 1e-6

    pos_loss = torch.nn.functional.huber_loss(
        pred_pos * mask, target_pos * mask, reduction="sum"
    ) / count
    radius_loss = torch.nn.functional.huber_loss(
        pred_radius * mask, target_radius * mask, reduction="sum"
    ) / count
    arc_loss = torch.nn.functional.huber_loss(
        pred_arc * mask, target_arc * mask, reduction="sum"
    ) / count
    rot_loss = torch.nn.functional.huber_loss(
        pred_rotation * mask, target_rotation * mask, reduction="sum"
    ) / count
    nozzle_loss = torch.nn.functional.huber_loss(
        pred_nozzle * target_exist,
        target_nozzle * target_exist,
        reduction="sum",
    ) / count
    body_loss = torch.nn.functional.huber_loss(
        pred_body * target_exist,
        target_body * target_exist,
        reduction="sum",
    ) / count

    geom = pos_loss + radius_loss + arc_loss + rot_loss + 0.25 * nozzle_loss + 0.25 * body_loss
    return exist_weight * exist_loss + geom_weight * geom
